import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");

    // If not logged in → redirect
    if (!token) {
      navigate("/");
    }

    // Handle Google redirect token
    const urlToken = new URLSearchParams(window.location.search).get("token");

    if (urlToken) {
      localStorage.setItem("token", urlToken);
    }
  }, []);

  return (
    <div>
      <h2>Welcome 🎉</h2>
      <p>You are logged in</p>
    </div>
  );
}