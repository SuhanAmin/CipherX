import os
import json
import requests
from dotenv import load_dotenv
from src.vectorstore import FaissVectorStore

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LLM_API_KEY = os.getenv("LLM_API_KEY")

# LLM configuration — OpenRouter API

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemma-4-31b-it:free")

class RAGSearch:
    def __init__(self, user_id=None, embedding_model: str = "all-MiniLM-L6-v2"):
        base_dir = os.path.join(BASE_DIR, "faiss_store")

        persist_dir = os.path.join(base_dir, str(user_id)) if user_id else base_dir

        self.vectorstore = FaissVectorStore(persist_dir, embedding_model)

        faiss_path = os.path.join(persist_dir, 'faiss.index')
        meta_path = os.path.join(persist_dir, 'metadata.pkl')

        if os.path.exists(faiss_path) and os.path.exists(meta_path):
            self.vectorstore.load()
        else:
            print("[INFO] No vector DB yet")

    # 🔥 STREAMING via OpenRouter (ChatCompletions API)
    def generate_with_llm_stream(self, prompt: str):
        try:
            res = requests.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5000",
                    "X-Title": "CipherX"
                },
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "stream": True,
                    "max_tokens": 512
                },
                stream=True,
                timeout=30
            )
            res.raise_for_status()
        except Exception as e:
            print("[ERROR] LLM CONNECTION ERROR:", str(e))
            yield "AI is currently offline. Please check the LLM API configuration."
            return

        # Parse SSE stream from OpenRouter (OpenAI-compatible format)
        for line in res.iter_lines():
            if not line:
                continue
            decoded = line.decode("utf-8")
            if not decoded.startswith("data: "):
                continue
            payload = decoded[6:]  # strip "data: "
            if payload.strip() == "[DONE]":
                break
            try:
                data = json.loads(payload)
                delta = data.get("choices", [{}])[0].get("delta", {})
                content = delta.get("content", "")
                if content:
                    yield content
            except Exception:
                pass

    # 🔍 MAIN RAG
    def search_and_summarize(self, query: str, top_k: int = 3):
        if not getattr(self.vectorstore, "index", None):
            return self.generate_with_llm_stream(query)

        try:
            results = self.vectorstore.query(query, top_k)
        except Exception as e:
            print("[ERROR] VECTOR ERROR:", str(e))
            return self.generate_with_llm_stream(query)

        if not results:
            return self.generate_with_llm_stream(query)

        if isinstance(results[0], list):
            results = results[0]

        seen = set()
        unique_results = []

        for r in results:
            text = r.get("metadata", {}).get("text", "")
            if text and text not in seen:
                seen.add(text)
                unique_results.append(r)

        unique_results.sort(key=lambda x: x["distance"])
        top_results = unique_results[:top_k]

        context = "\n\n".join([
            r["metadata"].get("text", "")
            for r in top_results
        ])

        if not context.strip():
            return self.generate_with_llm_stream(query)

        prompt = f"""
You are a professional AI assistant.

Answer clearly using the context. If not found, use general knowledge.

Context:
{context}

Question:
{query}

Answer:
"""

        return self.generate_with_llm_stream(prompt)

    # 📂 INGEST FILE
    def ingest_file(self, file_path: str):
        from src.data_loader import load_single_file
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        docs = load_single_file(file_path)
        if not docs:
            return {"status": "ignored", "message": "Unsupported file format or empty file"}
            
        self.vectorstore.add_documents(docs)
        return {"status": "success", "message": f"Successfully ingested {os.path.basename(file_path)}"}