from typing import Dict, List, Optional, Tuple, Any
from app.schemas import Topic, Probabilities, SemanticEvidence, PredictResponse
from app.config import settings

class HybridDecisionEngine:
    """
    Hybrid Decision Layer combining DeBERTa-v3-base Transformer classification
    with MiniLM semantic similarity supporting evidence.

    Core Principles:
    1. The Transformer remains the primary decision maker. MiniLM does not replace it.
    2. Primary rule: Normally, trust the Transformer prediction.
    3. Special CONTINUATION check:
       If DeBERTa predicts CONTINUATION but active-topic semantic similarity
       falls below `continuation_threshold`, the decision is reconsidered:
       The system compares Transformer SHIFT vs RETURN probabilities and selects
       whichever has stronger evidence.
    4. RETURN topic retrieval:
       When the final decision is RETURN, MiniLM identifies which previous topic
       the conversation has returned to by picking the highest similarity amongst
       previous (non-active) topics.
    """

    def __init__(self, default_threshold: float = settings.CONTINUATION_SIMILARITY_THRESHOLD):
        self.default_threshold = default_threshold

    @staticmethod
    def _format_prob(val: float) -> str:
        if val >= 0.001:
            return f"{val:.4f}"
        elif val > 0:
            return f"{val:.2e}"
        return "0.0000"

    def evaluate(
        self,
        transformer_result: Dict[str, Any],
        active_topic: Topic,
        previous_topics: List[Topic],
        current_message: str,
        all_similarities: Dict[str, float],
        custom_threshold: Optional[float] = None
    ) -> PredictResponse:
        threshold = custom_threshold if custom_threshold is not None else self.default_threshold
        raw_pred = transformer_result["prediction"]
        raw_conf = transformer_result["confidence"]
        raw_probs = transformer_result["probabilities"]

        # 1. Semantic evaluation
        active_sim = all_similarities.get(active_topic.topic_id, 0.0)

        # Separate previous topics
        prev_sims = {
            t.topic_id: all_similarities.get(t.topic_id, 0.0)
            for t in previous_topics
            if t.topic_id != active_topic.topic_id
        }

        best_prev_id: Optional[str] = None
        best_prev_sim: Optional[float] = None
        sim_margin: Optional[float] = None

        if prev_sims:
            best_prev_id = max(prev_sims, key=prev_sims.get)
            best_prev_sim = prev_sims[best_prev_id]
            sim_margin = round(best_prev_sim - active_sim, 4)

        semantic_evidence = SemanticEvidence(
            active_topic=active_topic.topic_id,
            active_similarity=round(active_sim, 4),
            best_previous_topic=best_prev_id,
            best_previous_similarity=round(best_prev_sim, 4) if best_prev_sim is not None else None,
            similarity_margin=sim_margin,
            all_similarities={k: round(v, 4) for k, v in all_similarities.items()}
        )

        final_prediction = raw_pred
        final_confidence = raw_conf
        override_applied = False
        reconsideration_reason = ""

        # Highest semantic similarity observed across all topics in memory
        max_all_sim = max(all_similarities.values()) if all_similarities else -1.0

        # 2. Global Novelty Check:
        # If the incoming message's similarity with ALL topics in memory is lower than the threshold,
        # it represents a completely new topic area and must be routed as a SHIFT.
        if max_all_sim < threshold:
            final_prediction = "SHIFT"
            final_confidence = raw_probs.get("SHIFT", raw_conf)
            override_applied = True
            reconsideration_reason = (
                f"Semantic similarity across all topics in memory was below threshold {threshold:.2f} "
                f"(highest similarity: {max_all_sim:.4f}). "
                f"ContextFlow routed the transition to SHIFT to register a new topic."
            )

        # 3. Special CONTINUATION check (if not already triggered by global novelty)
        elif raw_pred == "CONTINUATION" and active_sim < threshold:
            # Semantic evidence challenges CONTINUATION
            # Reconsider between SHIFT and RETURN based on Transformer probabilities
            shift_prob = raw_probs.get("SHIFT", 0.0)
            return_prob = raw_probs.get("RETURN", 0.0)

            override_applied = True
            if shift_prob >= return_prob:
                final_prediction = "SHIFT"
                final_confidence = shift_prob
                reconsideration_reason = (
                    f"Transformer initially predicted CONTINUATION, but semantic similarity to active topic "
                    f"'{active_topic.summary}' was unusually low ({active_sim:.4f} < threshold {threshold:.2f}). "
                    f"Hybrid layer reconsidered and selected SHIFT based on stronger Transformer evidence "
                    f"(SHIFT: {self._format_prob(shift_prob)} vs RETURN: {self._format_prob(return_prob)})."
                )
            else:
                final_prediction = "RETURN"
                final_confidence = return_prob
                reconsideration_reason = (
                    f"Transformer initially predicted CONTINUATION, but semantic similarity to active topic "
                    f"'{active_topic.summary}' was unusually low ({active_sim:.4f} < threshold {threshold:.2f}). "
                    f"Hybrid layer reconsidered and selected RETURN based on stronger Transformer evidence "
                    f"(RETURN: {self._format_prob(return_prob)} vs SHIFT: {self._format_prob(shift_prob)})."
                )

        # 4. RETURN Topic Identification & Verification
        returned_topic: Optional[Topic] = None
        if final_prediction == "RETURN":
            if best_prev_id is not None:
                for t in previous_topics:
                    if t.topic_id == best_prev_id:
                        returned_topic = t
                        break

            # If model or hybrid predicts RETURN but there are no historical topics to return to,
            # or the best previous topic similarity is below threshold,
            # route to SHIFT so a new topic is established.
            if returned_topic is None or (best_prev_sim is not None and best_prev_sim < threshold):
                final_prediction = "SHIFT"
                final_confidence = raw_probs.get("SHIFT", raw_conf)
                override_applied = True
                sim_str = f"{best_prev_sim:.4f}" if best_prev_sim is not None else "N/A"
                reconsideration_reason = (
                    f"A RETURN transition was evaluated, but similarity with historical topics was below threshold "
                    f"({sim_str} < {threshold:.2f}). "
                    f"ContextFlow routed the transition to SHIFT to establish a new topic."
                )

        # 4. Generate Explainability Narrative
        explanation = self._build_explanation(
            final_pred=final_prediction,
            raw_pred=raw_pred,
            raw_probs=raw_probs,
            active_topic=active_topic,
            active_sim=active_sim,
            best_prev_topic=returned_topic,
            best_prev_sim=best_prev_sim,
            override_applied=override_applied,
            reconsideration_reason=reconsideration_reason,
            threshold=threshold
        )

        return PredictResponse(
            prediction=final_prediction,
            confidence=round(final_confidence, 4),
            probabilities=Probabilities(
                CONTINUATION=round(raw_probs["CONTINUATION"], 5),
                SHIFT=round(raw_probs["SHIFT"], 5),
                RETURN=round(raw_probs["RETURN"], 5)
            ),
            semantic=semantic_evidence,
            returned_topic=returned_topic,
            explanation=explanation,
            hybrid_override_applied=override_applied,
            original_transformer_prediction=raw_pred
        )

    def _build_explanation(
        self,
        final_pred: str,
        raw_pred: str,
        raw_probs: Dict[str, float],
        active_topic: Topic,
        active_sim: float,
        best_prev_topic: Optional[Topic],
        best_prev_sim: Optional[float],
        override_applied: bool,
        reconsideration_reason: str,
        threshold: float
    ) -> str:
        lines = []

        if override_applied:
            lines.append(f"⚠️ HYBRID RECONSIDERATION TRIGGERED:")
            lines.append(reconsideration_reason)
            if final_pred == "RETURN" and best_prev_topic and best_prev_sim is not None:
                lines.append(
                    f"MiniLM retrieved target topic [{best_prev_topic.topic_id}] '{best_prev_topic.summary}' "
                    f"with cosine similarity of {best_prev_sim:.4f}."
                )
            return " ".join(lines)

        if final_pred == "RETURN":
            lines.append(
                f"DeBERTa detected a RETURN transition with {raw_probs.get('RETURN', 0.0)*100:.2f}% confidence."
            )
            if best_prev_topic and best_prev_sim is not None:
                lines.append(
                    f"MiniLM semantic retrieval identified candidate topic [{best_prev_topic.topic_id}] "
                    f"'{best_prev_topic.summary}' with cosine similarity of {best_prev_sim:.4f} "
                    f"(compared to active topic similarity of {active_sim:.4f})."
                )
            else:
                lines.append("No previous topic candidates were provided in the request context.")

        elif final_pred == "CONTINUATION":
            lines.append(
                f"DeBERTa identified CONTINUATION with {raw_probs.get('CONTINUATION', 0.0)*100:.2f}% confidence."
            )
            lines.append(
                f"Semantic similarity to active topic '{active_topic.summary}' is {active_sim:.4f}, "
                f"which clears the safety verification threshold ({threshold:.2f})."
            )

        elif final_pred == "SHIFT":
            lines.append(
                f"DeBERTa classified a topic SHIFT with {raw_probs.get('SHIFT', 0.0)*100:.2f}% confidence."
            )
            lines.append(
                f"Semantic correlation with the active topic '{active_topic.summary}' is {active_sim:.4f}."
            )

        return " ".join(lines)
