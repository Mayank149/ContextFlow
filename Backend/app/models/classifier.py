import os
import torch
import torch.nn.functional as F
from typing import List, Dict, Any, Union
from transformers import AutoTokenizer, AutoModelForSequenceClassification

from app.schemas import Message

class DebertaClassifier:
    """
    DeBERTa-v3-base sequence classification wrapper for ContextFlow.
    Predicts conversation transitions:
      0 -> CONTINUATION
      1 -> SHIFT
      2 -> RETURN
    Strictly runs on CPU.
    """

    LABEL2ID = {
        "CONTINUATION": 0,
        "SHIFT": 1,
        "RETURN": 2
    }

    ID2LABEL = {
        0: "CONTINUATION",
        1: "SHIFT",
        2: "RETURN"
    }

    def __init__(self, model_path: str):
        self.model_path = model_path
        self.device = torch.device("cpu")
        self.tokenizer = None
        self.model = None
        self.is_loaded = False

    def load(self):
        if self.is_loaded:
            return

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model path does not exist: {self.model_path}")

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        except Exception:
            self.tokenizer = AutoTokenizer.from_pretrained("microsoft/deberta-v3-base")

        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_path,
            torch_dtype=torch.float32
        )
        self.model = self.model.to(self.device)
        self.model.eval()
        self.is_loaded = True

    def format_recent_history(self, history: List[Union[Message, Dict[str, Any]]], n_messages: int = 4) -> str:
        """
        Format up to n_messages from the end of history in 'Role: Content' format,
        matching the fine-tuned DeBERTa training format.
        """
        if not history:
            return "User: Hello"

        recent = history[-n_messages:]
        parts = []
        for message in recent:
            if hasattr(message, "role"):
                role = message.role.capitalize()
                content = message.content
            else:
                role = message.get("role", "User").capitalize()
                content = message.get("content", "")
            parts.append(f"{role}: {content}")

        return "\n".join(parts)

    def build_model_input(
        self,
        history: List[Union[Message, Dict[str, Any]]],
        active_topic_summary: str,
        current_message: str,
        n_messages: int = 4
    ) -> str:
        """
        Constructs the exact sequence fed into the tokenizer during training:
        {recent_context} [SEP] {active_topic_summary} [SEP] {current_message}
        """
        recent_context = self.format_recent_history(history, n_messages=n_messages)
        return (
            f"{recent_context} "
            f"[SEP] "
            f"{active_topic_summary} "
            f"[SEP] "
            f"{current_message}"
        )

    def predict(
        self,
        history: List[Union[Message, Dict[str, Any]]],
        active_topic_summary: str,
        current_message: str
    ) -> Dict[str, Any]:
        """
        Runs CPU forward pass through DeBERTa and returns transition probabilities.
        """
        if not self.is_loaded:
            self.load()

        text = self.build_model_input(history, active_topic_summary, current_message)

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=256
        )

        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)

        probabilities = F.softmax(outputs.logits, dim=-1)[0]
        predicted_id = torch.argmax(probabilities).item()

        return {
            "prediction": self.ID2LABEL[predicted_id],
            "confidence": float(probabilities[predicted_id].item()),
            "probabilities": {
                self.ID2LABEL[i]: float(probabilities[i].item())
                for i in range(3)
            },
            "raw_input_text": text
        }
