import os
import re
import pickle
import random
from typing import List, Dict, Any
from sklearn.feature_extraction import DictVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pii_model.pkl")

# Helper to compute character shape
def get_shape(token: str) -> str:
    shape = []
    for c in token:
        if c.isupper():
            shape.append("X")
        elif c.islower():
            shape.append("x")
        elif c.isdigit():
            shape.append("d")
        else:
            shape.append(c)
    # Collapse consecutive duplicates (e.g. "dddd" -> "d", "XXXX" -> "X")
    collapsed = []
    for char in shape:
        if not collapsed or collapsed[-1] != char:
            collapsed.append(char)
    return "".join(collapsed)

# Tokenize text separating punctuation but keeping emails intact
def tokenize(text: str) -> List[str]:
    pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*|\w+|[^\w\s]"
    return re.findall(pattern, text)

# Feature extraction function for a single token at index i in tokens list
def extract_token_features(tokens: List[str], i: int) -> Dict[str, Any]:
    token = tokens[i]
    features = {
        "bias": 1.0,
        "token.lower()": token.lower(),
        "token.len()": len(token),
        "token.isupper()": token.isupper(),
        "token.istitle()": token.istitle(),
        "token.isdigit()": token.isdigit(),
        "token.isalphanumeric()": token.isalnum(),
        "token.shape": get_shape(token),
        "token.has_at": "@" in token,
        "token.has_dash": "-" in token,
        "token.has_slash": "/" in token,
    }
    
    # Prefix features
    if i > 0:
        features["prefix_1.lower()"] = tokens[i-1].lower()
        features["prefix_1.shape"] = get_shape(tokens[i-1])
        features["prefix_1.isdigit()"] = tokens[i-1].isdigit()
    else:
        features["BOS"] = True
        
    if i > 1:
        features["prefix_2.lower()"] = tokens[i-2].lower()
    
    # Suffix features
    if i < len(tokens) - 1:
        features["suffix_1.lower()"] = tokens[i+1].lower()
        features["suffix_1.shape"] = get_shape(tokens[i+1])
        features["suffix_1.isdigit()"] = tokens[i+1].isdigit()
    else:
        features["EOS"] = True
        
    if i < len(tokens) - 2:
        features["suffix_2.lower()"] = tokens[i+2].lower()
        
    # Context window keywords check (left/right 3 tokens)
    window = tokens[max(0, i-3):min(len(tokens), i+4)]
    window_lower = [t.lower() for t in window]
    features["context.has_otp"] = any(w in window_lower for w in ["otp", "pin", "code", "passcode", "verification"])
    features["context.has_phone"] = any(w in window_lower for w in ["phone", "mobile", "call", "contact", "number", "tel"])
    features["context.has_aadhaar"] = any(w in window_lower for w in ["aadhaar", "adhar", "uidai", "uid"])
    features["context.has_pan"] = any(w in window_lower for w in ["pan", "pancard", "card", "tax"])
    features["context.has_dob"] = any(w in window_lower for w in ["dob", "birth", "born", "date", "birthdate", "age"])
    features["context.has_bank"] = any(w in window_lower for w in ["bank", "account", "acc", "ifsc", "transfer", "deposit", "savings"])
    
    return features

# Synthetic Data Generation for Training the ML Classifier
def generate_synthetic_data() -> List[tuple]:
    data = []
    
    # Pools of values to sample from
    emails = ["john.doe@gmail.com", "support@company.in", "admin@domain.com", "user123@yahoo.co.in", "hr_team@startup.io"]
    phones = ["9876543210", "8123456789", "7012345678", "9988776655", "6299881122", "+919876543210", "+91 9999988888"]
    aadhaars = ["1234 5678 9012", "9876 5432 1098", "4567 8901 2345", "1111 2222 3333", "888899990000", "901234567890"]
    pans = ["ABCDE1234F", "XYZWP9876A", "QWERTY5432Z", "PLMKO9012X", "ASDFG5678H"]
    otps = ["4321", "9876", "123456", "987654", "0981", "8823", "204891"]
    dobs = ["12-05-1995", "01/01/2000", "23-11-1988", "15/08/1947", "09-02-2002"]
    banks = ["123456789012", "98765432109876", "554433221100", "11223344556677", "908070605040"]
    
    # 1. Emails
    for email in emails:
        data.append((f"My email is {email}.", [("email", email)]))
        data.append((f"Contact me at {email} for details.", [("email", email)]))
        data.append((f"Send the document to {email} immediately.", [("email", email)]))
        
    # 2. Phones
    for phone in phones:
        data.append((f"My mobile number is {phone}.", [("phone", phone)]))
        data.append((f"Please call me at {phone} as soon as possible.", [("phone", phone)]))
        data.append((f"Contact number: {phone}.", [("phone", phone)]))
        
    # 3. Aadhaar
    for aadhaar in aadhaars:
        data.append((f"My Aadhaar card number is {aadhaar}.", [("aadhaar", aadhaar)]))
        data.append((f"Submit your Aadhaar copy: {aadhaar}.", [("aadhaar", aadhaar)]))
        data.append((f"Aadhaar: {aadhaar} for verification.", [("aadhaar", aadhaar)]))
        
    # 4. PAN
    for pan in pans:
        data.append((f"Your PAN number is {pan}.", [("pan", pan)]))
        data.append((f"Tax identification card PAN: {pan}.", [("pan", pan)]))
        data.append((f"Submit PAN {pan} to HR.", [("pan", pan)]))
        
    # 5. OTP
    for otp in otps:
        data.append((f"Your OTP is {otp}.", [("otp", otp)]))
        data.append((f"Do not share your verification code {otp} with anyone.", [("otp", otp)]))
        data.append((f"Use code {otp} to sign in.", [("otp", otp)]))
        
    # 6. DOB
    for dob in dobs:
        data.append((f"My date of birth is {dob}.", [("dob", dob)]))
        data.append((f"Born on {dob} in Mumbai.", [("dob", dob)]))
        data.append((f"DOB: {dob}.", [("dob", dob)]))
        
    # 7. Bank
    for bank in banks:
        data.append((f"My account number is {bank}.", [("bank", bank)]))
        data.append((f"Send money to bank account: {bank}.", [("bank", bank)]))
        data.append((f"Savings account {bank} has been updated.", [("bank", bank)]))
        
    # 8. Clean / Normal sentences (No PII)
    clean = [
        "The project update is scheduled for tomorrow morning.",
        "There are 24 items in the list of products.",
        "We need to buy 15 apples and 2 bottles of water.",
        "Meeting room 4 is booked from 10:00 to 11:30 AM.",
        "The coordinates are 12.9716 N and 77.5946 E.",
        "The version number of the software is 2.4.0.",
        "He has 3 siblings and 5 cousins.",
        "Please read the user guidelines before continuing.",
        "This is a general inquiry about subscription models.",
        "The test score was 98.5 percent."
    ]
    for c in clean:
        data.append((c, []))
        
    return data

# Convert synthetic sentences into token list and target labels (IOB format)
def build_dataset() -> tuple:
    raw_data = generate_synthetic_data()
    X_features = []
    y_labels = []
    
    for sentence, pii_list in raw_data:
        tokens = tokenize(sentence)
        labels = ["O"] * len(tokens)
        
        # Locate the PII substrings and label tokens
        for pii_type, pii_val in pii_list:
            pii_tokens = tokenize(pii_val)
            pii_len = len(pii_tokens)
            
            # Find matching subsequence of tokens
            for start_idx in range(len(tokens) - pii_len + 1):
                if tokens[start_idx:start_idx + pii_len] == pii_tokens:
                    labels[start_idx] = f"B-{pii_type}"
                    for offset in range(1, pii_len):
                        labels[start_idx + offset] = f"I-{pii_type}"
                    break
        
        for idx in range(len(tokens)):
            X_features.append(extract_token_features(tokens, idx))
            y_labels.append(labels[idx])
            
    return X_features, y_labels

class MLPIIDetector:
    def __init__(self):
        self.pipeline = None
        self.load_model()
        
    def train_model(self):
        print("[PII-ML] Training Machine Learning model for PII detection...")
        X, y = build_dataset()
        
        # Build training pipeline (DictVectorizer + RandomForest)
        pipeline = Pipeline([
            ("vectorizer", DictVectorizer(sparse=True)),
            ("classifier", RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1))
        ])
        
        pipeline.fit(X, y)
        
        # Save model
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(pipeline, f)
            
        self.pipeline = pipeline
        print("[PII-ML] PII ML Model trained and saved successfully.")
        
    def load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    self.pipeline = pickle.load(f)
                print("[PII-ML] PII ML Model loaded from disk.")
            except Exception as e:
                print(f"[PII-ML] Failed to load PII ML model: {e}")
                self.train_model()
        else:
            self.train_model()
            
    def detect(self, text: str) -> List[Dict[str, Any]]:
        if not self.pipeline:
            return []
            
        tokens = tokenize(text)
        if not tokens:
            return []
            
        # Extract features for all tokens
        features = [extract_token_features(tokens, i) for i in range(len(tokens))]
        predictions = self.pipeline.predict(features)
        
        results = []
        current_entity = []
        current_type = None
        
        # Combine B- and I- tokens back into single entity groups
        for idx, (token, pred) in enumerate(zip(tokens, predictions)):
            if pred.startswith("B-"):
                if current_entity:
                    results.append({
                        "value": " ".join(current_entity),
                        "type": current_type
                    })
                current_entity = [token]
                current_type = pred.split("-")[1]
            elif pred.startswith("I-") and current_type == pred.split("-")[1]:
                current_entity.append(token)
            else:
                if current_entity:
                    results.append({
                        "value": " ".join(current_entity),
                        "type": current_type
                    })
                    current_entity = []
                    current_type = None
                    
        # Append remaining active entity
        if current_entity:
            results.append({
                "value": " ".join(current_entity),
                "type": current_type
            })
            
        # Post-processing: clean up tokenizer join artifacts while correcting model misclassifications structurally
        processed_results = []
        seen = set()
        
        for r in results:
            val = r["value"]
            orig_type = r["type"]
            corrected_type = orig_type
            
            # Clean up spacing first
            if orig_type == "email":
                val = val.replace(" ", "")
            elif orig_type == "dob":
                val = val.replace(" - ", "-").replace(" / ", "/")
                val = re.sub(r'\s*-\s*', '-', val)
                val = re.sub(r'\s*/\s*', '/', val)
            elif orig_type == "phone":
                val = val.replace(" + ", "+").replace("+ ", "+")
            elif orig_type == "aadhaar":
                val = re.sub(r"\s+", " ", val).strip()
            elif orig_type == "pan":
                val = val.replace(" ", "")

            # Structurally correct the entity type to eliminate ML classification errors
            digits_only = re.sub(r"\D", "", val)
            
            if "@" in val:
                corrected_type = "email"
            elif re.search(r"\b[A-Za-z]{5}\d{4}[A-Za-z]\b", val.replace(" ", "")):
                corrected_type = "pan"
            elif re.search(r"\b(?:0?[1-9]|[12]\d|3[01])[-/](?:0?[1-9]|1[0-2])[-/](?:19|20)\d{2}\b", val.replace(" ", "")):
                corrected_type = "dob"
            elif len(digits_only) > 0:
                # Digital entities (Phone vs Aadhaar vs OTP vs Bank)
                if len(digits_only) == 12:
                    if digits_only.startswith("91") or digits_only.startswith("0"):
                        corrected_type = "phone"
                    else:
                        corrected_type = "aadhaar"
                elif len(digits_only) == 10 or len(digits_only) == 11:
                    corrected_type = "phone"
                elif len(digits_only) in [4, 6] and orig_type == "otp":
                    corrected_type = "otp"
                elif len(digits_only) >= 9 and len(digits_only) <= 18 and orig_type == "bank":
                    corrected_type = "bank"

            # Enforce phone length validation to filter out model artifacts (+91 alone or 5-digit phone parts)
            if corrected_type == "phone":
                if len(digits_only) not in [10, 11, 12]:
                    continue

            # Prevent 6-digit pincodes from being misclassified as OTP
            if corrected_type == "otp":
                if len(digits_only) not in [4, 6]:
                    continue
                if len(digits_only) == 6:
                    val_lines = [l.lower() for l in text.splitlines() if val in l]
                    is_pincode = False
                    for l in val_lines:
                        if any(k in l for k in ["pincode", "pin code", "zip", "postal"]):
                            is_pincode = True
                            break
                    if is_pincode:
                        continue

            # Enforce strict DOB structure check
            if corrected_type == "dob":
                clean_val = val.strip()
                pattern1 = r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b"
                pattern2 = r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b"
                pattern3 = r"\b\d{1,2}[-\s/](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s/]\d{2,4}\b"
                pattern4 = r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s/]\d{1,2}[-,\s/]\s*\d{2,4}\b"
                
                is_valid = (
                    re.search(pattern1, clean_val) or
                    re.search(pattern2, clean_val) or
                    re.search(pattern3, clean_val, re.IGNORECASE) or
                    re.search(pattern4, clean_val, re.IGNORECASE)
                )
                if not is_valid:
                    continue

            # Enforce strict PAN structure check
            if corrected_type == "pan":
                clean_pan = val.replace(" ", "").upper()
                if not re.search(r"^[A-Z]{5}\d{4}[A-Z]$", clean_pan):
                    continue

            # Enforce strict Aadhaar structure check
            if corrected_type == "aadhaar":
                if len(digits_only) != 12:
                    continue

            # Enforce strict Email structure check
            if corrected_type == "email":
                clean_email = val.replace(" ", "")
                if not re.search(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", clean_email):
                    continue

            # Enforce bank account length check
            if corrected_type == "bank":
                if len(digits_only) < 9 or len(digits_only) > 18:
                    continue

            key = f"{corrected_type}:{val}"
            if key not in seen:
                seen.add(key)
                processed_results.append({
                    "value": val,
                    "type": corrected_type
                })
                
        return processed_results

# Create singleton instance
detector = MLPIIDetector()
