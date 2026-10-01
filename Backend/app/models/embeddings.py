import torch
import torch.nn.functional as F
from typing import Dict, Union, List
from sentence_transformers import SentenceTransformer

class SemanticEmbeddingEngine:
    """
    MiniLM semantic topic retrieval layer (sentence-transformers/all-MiniLM-L6-v2).
    Computes normalized embeddings on CPU and calculates cosine similarities
    to provide supporting evidence for RETURN detection and topic selection.
    """

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.device = "cpu"
        self.model = None
        self.is_loaded = False
        self._embedding_cache: Dict[str, torch.Tensor] = {}

    def load(self):
        if self.is_loaded:
            return
        # Explicit CPU initialization - no GPU / CUDA detection
        self.model = SentenceTransformer(self.model_name, device=self.device)
        self.is_loaded = True

    def encode(self, text: str) -> torch.Tensor:
        """
        Encode text into a normalized embedding vector on CPU.
        Uses in-memory cache for static strings like topic summaries.
        """
        if not self.is_loaded:
            self.load()

        if text in self._embedding_cache:
            return self._embedding_cache[text]

        embedding = self.model.encode(
            text,
            convert_to_tensor=True,
            normalize_embeddings=True,
            device=self.device
        )
        # Detach from graph and keep on CPU
        embedding = embedding.detach().cpu()
        self._embedding_cache[text] = embedding
        return embedding

    def compute_similarity(self, emb1: torch.Tensor, emb2: torch.Tensor) -> float:
        """
        Computes cosine similarity between two 1D normalized embedding tensors.
        """
        sim = F.cosine_similarity(emb1.unsqueeze(0), emb2.unsqueeze(0)).item()
        return round(float(sim), 4)

    def get_similarities(
        self,
        current_message: str,
        topic_summaries: Dict[str, str]
    ) -> Dict[str, float]:
        """
        Computes cosine similarity between the current message and all given topic summaries.
        topic_summaries is a dict of {topic_id: summary_text}.
        """
        if not topic_summaries:
            return {}

        current_embedding = self.encode(current_message)
        similarities = {}

        for topic_id, summary in topic_summaries.items():
            topic_embedding = self.encode(summary)
            similarities[topic_id] = self.compute_similarity(current_embedding, topic_embedding)

        return similarities
