import os
import requests
from dotenv import load_dotenv
from src.vectorstore import FaissVectorStore

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class RAGSearch:
    def __init__(self, persist_dir: str = None, embedding_model: str = "all-MiniLM-L6-v2"):

        # 📁 Set FAISS storage path
        if persist_dir is None:
            persist_dir = os.path.join(BASE_DIR, "faiss_store")

        self.vectorstore = FaissVectorStore(persist_dir, embedding_model)

        # 📂 Paths
        faiss_path = os.path.join(persist_dir, 'faiss.index')
        meta_path = os.path.join(persist_dir, 'metadata.pkl')

        # 🔧 Build or load vector store
        if not (os.path.exists(faiss_path) and os.path.exists(meta_path)):
            from src.data_loader import load_all_documents

            docs = load_all_documents(os.path.join(BASE_DIR, "data"))
            self.vectorstore.build_from_documents(docs)
        else:
            self.vectorstore.load()

    # 🔥 OLLAMA CALL
    def generate_with_ollama(self, prompt: str):
        try:
            print("📤 PROMPT SENT TO OLLAMA:\n", prompt[:200])

            res = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "phi",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 200   # 🔥 force longer output
                    }
                },
                timeout=60
            )

            print("📡 STATUS:", res.status_code)
            print("📡 RAW TEXT:", res.text)

            data = res.json()
            response = data.get("response", "").strip()

            # 🔥 FIX 1: EMPTY RESPONSE → SIMPLE FALLBACK
            if not response:
                print("⚠️ Empty response → fallback")

                fallback_prompt = f"""
    Explain clearly in simple words:

    {prompt}
    """

                retry = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "phi",
                        "prompt": fallback_prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.8,
                            "num_predict": 200
                        }
                    },
                    timeout=60
                )

                retry_data = retry.json()
                response = retry_data.get("response", "").strip()

            return response if response else "AI could not generate a response."

        except Exception as e:
            print("❌ OLLAMA ERROR:", str(e))
            return "AI service failed"
    def ingest_file(self, file_path: str):
        from src.data_loader import load_single_file

        # 🔥 FIX PATH
        if not os.path.isabs(file_path):
            file_path = os.path.join(BASE_DIR, "..", file_path)

        file_path = os.path.abspath(file_path)

        print("📂 Ingesting:", file_path)

        docs = load_single_file(file_path)

        if not docs:
            return {"message": "No content extracted"}

        self.vectorstore.add_documents(docs)

        return {"message": "File stored in vector DB"}
    # 🔍 MAIN RAG PIPELINE
    def search_and_summarize(self, query: str, top_k: int = 3):

        # 🔎 Search vector DB
        results = self.vectorstore.query(query, top_k)

        # 🛠 Fix nested issue
        if results and isinstance(results[0], list):
            results = results[0]

        # 🧹 Remove duplicates
        seen = set()
        unique_results = []

        for r in results:
            metadata = r.get("metadata")

            if metadata and isinstance(metadata, dict):
                text = metadata.get("text", "")
            else:
                continue
            if text not in seen:
                seen.add(text)
                unique_results.append(r)

        # 📊 Sort by similarity
        unique_results.sort(key=lambda x: x["distance"])

        # 🎯 Pick top results
        top_results = unique_results[:top_k]

        # 🧠 Build context
        texts = [
            r["metadata"].get("text", "")
            for r in top_results
            if r.get("metadata")
        ]

        context = "\n\n".join(texts)

        # 🤖 If no context → fallback to LLM only
        if not context.strip():
            return self.generate_with_ollama(query)

        # 🧾 FINAL PROMPT (VERY IMPORTANT)
        prompt = f"""
You are a professional AI assistant.

Answer the question clearly and concisely using the provided context.

If the answer is not in the context, answer based on general knowledge.

Context:
{context}

Question:
{query}

Answer:
"""

        # 🚀 Generate answer
        return self.generate_with_ollama(prompt)