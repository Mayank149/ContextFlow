from typing import Dict, List, Optional, Tuple
import torch
from app.schemas import Topic
from app.models.embeddings import SemanticEmbeddingEngine

class TopicMemoryService:
    """
    Lightweight in-memory topic memory system for ContextFlow.
    Maintains active topic, previous topics, summaries, and precomputed embeddings.
    """

    def __init__(self, embedding_engine: SemanticEmbeddingEngine):
        self.embedding_engine = embedding_engine
        self.topics: Dict[str, Dict[str, any]] = {}
        self.active_topic_id: Optional[str] = None

    def add_topic(self, topic_id: str, summary: str) -> Topic:
        """Register or update a topic in memory with its normalized embedding."""
        embedding = self.embedding_engine.encode(summary)
        self.topics[topic_id] = {
            "topic_id": topic_id,
            "summary": summary,
            "embedding": embedding
        }
        if self.active_topic_id is None:
            self.active_topic_id = topic_id
        return Topic(topic_id=topic_id, summary=summary)

    def set_active_topic(self, topic_id: str) -> Optional[Topic]:
        if topic_id in self.topics:
            self.active_topic_id = topic_id
            return Topic(topic_id=topic_id, summary=self.topics[topic_id]["summary"])
        return None

    def get_active_topic(self) -> Optional[Topic]:
        if self.active_topic_id and self.active_topic_id in self.topics:
            return Topic(
                topic_id=self.active_topic_id,
                summary=self.topics[self.active_topic_id]["summary"]
            )
        return None

    def get_previous_topics(self) -> List[Topic]:
        return [
            Topic(topic_id=t_id, summary=data["summary"])
            for t_id, data in self.topics.items()
            if t_id != self.active_topic_id
        ]

    def get_all_topics(self) -> List[Topic]:
        return [
            Topic(topic_id=t_id, summary=data["summary"])
            for t_id, data in self.topics.items()
        ]

    def get_topic_by_id(self, topic_id: str) -> Optional[Topic]:
        if topic_id in self.topics:
            return Topic(topic_id=topic_id, summary=self.topics[topic_id]["summary"])
        return None

    def reset_with_defaults(self):
        """Seed initial default conversation topics from the canonical ContextFlow dataset."""
        self.topics.clear()
        self.add_topic("T1", "Preparing for a machine learning interview")
        self.add_topic("T2", "Developing and deploying REST APIs")
        self.add_topic("T3", "Deploying Flask applications")
        self.active_topic_id = "T3"
