from typing import Dict, Any, Optional
from app.models.classifier import DebertaClassifier
from app.models.embeddings import SemanticEmbeddingEngine
from app.services.hybrid_decision import HybridDecisionEngine
from app.schemas import PredictRequest, PredictResponse

class PredictionPipeline:
    """
    Main orchestration service for ContextFlow.
    Executes:
      1. Sequence classification using fine-tuned DeBERTa-v3-base
      2. MiniLM semantic similarity extraction for active & previous topics
      3. Hybrid decision logic (CONTINUATION verification & RETURN topic resolution)
    """

    def __init__(
        self,
        classifier: DebertaClassifier,
        embedding_engine: SemanticEmbeddingEngine,
        hybrid_engine: HybridDecisionEngine
    ):
        self.classifier = classifier
        self.embedding_engine = embedding_engine
        self.hybrid_engine = hybrid_engine

    def predict(self, request: PredictRequest) -> PredictResponse:
        # 1. Prepare topic summaries dictionary
        all_topics_dict = {
            request.active_topic.topic_id: request.active_topic.summary
        }
        for topic in request.previous_topics:
            all_topics_dict[topic.topic_id] = topic.summary

        # 2. MiniLM Semantic Similarities
        similarities = self.embedding_engine.get_similarities(
            current_message=request.current_message,
            topic_summaries=all_topics_dict
        )

        # 3. DeBERTa Transformer Prediction
        transformer_result = self.classifier.predict(
            history=request.history,
            active_topic_summary=request.active_topic.summary,
            current_message=request.current_message
        )

        # 4. Hybrid Decision Layer
        response = self.hybrid_engine.evaluate(
            transformer_result=transformer_result,
            active_topic=request.active_topic,
            previous_topics=request.previous_topics,
            current_message=request.current_message,
            all_similarities=similarities,
            custom_threshold=request.continuation_threshold
        )

        return response
