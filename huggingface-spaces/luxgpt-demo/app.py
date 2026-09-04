#!/usr/bin/env python3
"""
LuxGPT-basedEN Demo Space
A simple Streamlit app to demonstrate the LuxGPT-basedEN model from Hugging Face.
"""

import os
import streamlit as st
from huggingface_hub import InferenceClient

# Page configuration
st.set_page_config(
    page_title="LuxGPT-basedEN Demo",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main {
        background-color: #f8f9fa;
    }
    .stChatInput {
        position: fixed;
        bottom: 20px;
        width: 80%;
    }
    .model-info {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
    }
</style>
""", unsafe_allow_html=True)

# Title
st.title("⚖️ LuxGPT-basedEN Legal AI Demo")
st.markdown("Powered by [laurabernardy/LuxGPT-basedEN](https://huggingface.co/laurabernardy/LuxGPT-basedEN)")

# Model info
st.markdown("""
<div class="model-info">
    <h3>🤖 About LuxGPT-basedEN</h3>
    <p><strong>Model:</strong> laurabernardy/LuxGPT-basedEN</p>
    <p><strong>Type:</strong> Legal Knowledge Model (Fine-tuned from LuxGPT)</p>
    <p><strong>Best for:</strong> Legal Q&A, Knowledge Retrieval, English Legal Tasks</p>
</div>
""", unsafe_allow_html=True)

# Sidebar
with st.sidebar:
    st.header("⚙️ Configuration")
    
    # Temperature slider
    temperature = st.slider("Temperature", 0.0, 1.0, 0.2, 0.05)
    st.write("Higher = more creative, Lower = more deterministic")
    
    st.markdown("---")
    st.markdown("### 📚 Example Prompts")
    examples = [
        "What are the key principles of contract law?",
        "Explain the concept of due diligence.",
        "What is the legal definition of negligence?",
        "What are the elements of a valid contract?",
        "How does tort law differ from contract law?"
    ]
    
    for example in examples:
        if st.button(example[:50] + "..." if len(example) > 50 else example):
            st.session_state.messages.append({"role": "user", "content": example})
    
    st.markdown("---")
    st.markdown("### 🔗 Links")
    st.link_button("Model on Hugging Face", "https://huggingface.co/laurabernardy/LuxGPT-basedEN")
    st.link_button("Cairn Private Knowledge", "https://github.com/saintus-create/cairn-private-knowledge")
    
    st.markdown("---")
    st.markdown("### 💡 Tip")
    st.info("For best results, ask specific legal questions or request explanations of legal concepts.")

# Initialize chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat messages
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Accept user input
if prompt := st.chat_input("Ask a legal question..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    
    # Display user message
    with st.chat_message("user"):
        st.markdown(prompt)
    
    # Display assistant response
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""
        
        try:
            # Initialize Hugging Face client
            token = os.getenv("HF_TOKEN", "")
            if not token:
                st.error("Hugging Face token not configured. Please add HF_TOKEN as a secret.")
                st.stop()
            
            client = InferenceClient(token=token)
            
            # Build messages for chat completion
            system_message = {
                "role": "system",
                "content": "You are a helpful legal assistant. Provide accurate, clear answers to legal questions. "
                           "Base your responses on general legal principles. If a question requires jurisdiction-specific "
                           "information, note that laws vary by jurisdiction."
            }
            
            # Format messages for Hugging Face API
            # LuxGPT-basedEN may support chat/completions or text generation
            conversation = [system_message] + st.session_state.messages
            
            # Try chat/completions endpoint first
            try:
                response = client.chat_completion(
                    model="laurabernardy/LuxGPT-basedEN",
                    messages=conversation,
                    temperature=temperature,
                    max_tokens=1024
                )
                assistant_message = response.choices[0].message.content
            except Exception as e:
                # Fall back to text generation
                user_prompt = conversation[-1]["content"]
                response = client.text_generation(
                    model="laurabernardy/LuxGPT-basedEN",
                    inputs=user_prompt,
                    parameters={
                        "temperature": temperature,
                        "max_new_tokens": 1024,
                        "return_full_text": False
                    }
                )
                assistant_message = response
            
            # Stream the response
            assistant_message = str(assistant_message)
            full_response = assistant_message
            
            # Display the full response
            message_placeholder.markdown(full_response)
            
        except Exception as e:
            st.error(f"Error: {str(e)}")
            st.stop()
    
    # Add assistant response to chat history
    st.session_state.messages.append({"role": "assistant", "content": full_response})

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #666; padding: 20px;'>
    <p>Built with ❤️ using Hugging Face Inference API | Model: laurabernardy/LuxGPT-basedEN</p>
</div>
""", unsafe_allow_html=True)
