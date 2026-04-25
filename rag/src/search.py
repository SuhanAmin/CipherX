import os
import requests
from dotenv import load_dotenv
from src.vectorstore import FaissVectorStore

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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
            print("⚠️ No vector DB yet")

    # 🔥 STREAMING OLLAMA
    def generate_with_ollama_stream(self, prompt: str):
        res = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "tinyllama",
                "prompt": prompt,
                "stream": True,
                "options": {
                    "num_predict": 100
                }
            },
            stream=True
        )

        for line in res.iter_lines():
            if line:
                try:
                    import json
                    data = json.loads(line.decode("utf-8"))
                    if "response" in data:
                        yield data["response"]
                except Exception:
                    pass

    # 🔍 MAIN RAG
    def search_and_summarize(self, query: str, top_k: int = 3):
        if not getattr(self.vectorstore, "index", None):
            return self.generate_with_ollama_stream(query)

        try:
            results = self.vectorstore.query(query, top_k)
        except Exception as e:
            print("❌ VECTOR ERROR:", str(e))
            return self.generate_with_ollama_stream(query)

        if not results:
            return self.generate_with_ollama_stream(query)

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
            return self.generate_with_ollama_stream(query)

        prompt = f"""
You are a professional AI assistant.

Answer clearly using the context. If not found, use general knowledge.

Context:
{context}

Question:
{query}

Answer:
"""

        return self.generate_with_ollama_stream(prompt)