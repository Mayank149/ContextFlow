from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class Message(BaseModel):
    role: str = Field(..., description="Role of the speaker: user, assistant, or system")
    content: str = Field(..., description="Text content of the message")

class Topic(BaseModel):
    topic_id: str = Field(..., description="Unique topic identifier (e.g. T1, T2)")
    summary: str = Field(..., description="Summary or name of the topic")

class PredictRequest(BaseModel):
    history: List[Message] = Field(default_factory=list, description="Recent conversation turns")
    active_topic: Topic = Field(..., description="Currently active conversation topic")
    previous_topics: List[Topic] = Field(default_factory=list, description="Historical topics discussed previously")
    current_message: str = Field(..., description="Incoming user message to analyze")
    continuation_threshold: Optional[float] = Field(
        None,
        description="Optional custom similarity threshold to trigger CONTINUATION check (defaults to server config)"
    )

class Probabilities(BaseModel):
    CONTINUATION: float
    SHIFT: float
    RETURN: float

class SemanticEvidence(BaseModel):
    active_topic: str
    active_similarity: float
    best_previous_topic: Optional[str] = None
    best_previous_similarity: Optional[float] = None
    similarity_margin: Optional[float] = None
    all_similarities: Dict[str, float] = Field(default_factory=dict)

class PredictResponse(BaseModel):
    prediction: str = Field(..., description="Final predicted transition: CONTINUATION, SHIFT, or RETURN")
    confidence: float = Field(..., description="Confidence score of the final prediction (0.0 - 1.0)")
    probabilities: Probabilities = Field(..., description="DeBERTa probability distribution across transitions")
    semantic: SemanticEvidence = Field(..., description="MiniLM semantic similarity scores")
    returned_topic: Optional[Topic] = Field(None, description="Identified previous topic if transition is RETURN")
    explanation: str = Field(..., description="Human-readable explainability narrative")
    hybrid_override_applied: bool = Field(False, description="True if hybrid logic reconsidered a suspicious CONTINUATION")
    original_transformer_prediction: str = Field(..., description="Raw prediction from DeBERTa before hybrid check")

class TopicCreateRequest(BaseModel):
    topic_id: str
    summary: str

class TopicMemoryResponse(BaseModel):
    active_topic: Optional[Topic] = None
    previous_topics: List[Topic] = Field(default_factory=list)
    total_stored: int

class HealthResponse(BaseModel):
    status: str
    device: str
    transformer_loaded: bool
    embedding_loaded: bool
    transformer_model: str
    embedding_model: str
