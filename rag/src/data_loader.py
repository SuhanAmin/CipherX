from pathlib import Path
from typing import List, Any
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader
from langchain_community.document_loaders import Docx2txtLoader
from langchain_community.document_loaders.excel import UnstructuredExcelLoader
from langchain_community.document_loaders import JSONLoader


def load_single_file(file_path):
    file_path = Path(file_path)

    if file_path.suffix == ".pdf":
        loader = PyPDFLoader(str(file_path))

    elif file_path.suffix == ".txt":
        loader = TextLoader(str(file_path), encoding="utf-8")

    elif file_path.suffix == ".csv":
        loader = CSVLoader(str(file_path))

    elif file_path.suffix == ".docx":
        loader = Docx2txtLoader(str(file_path))

    elif file_path.suffix == ".xlsx":
        loader = UnstructuredExcelLoader(str(file_path))

    elif file_path.suffix == ".json":
        loader = JSONLoader(str(file_path))

    else:
        return []

    return loader.load()