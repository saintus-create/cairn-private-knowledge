# LuxGPT-basedEN Demo

A Hugging Face Space demonstrating the [LuxGPT-basedEN](https://huggingface.co/laurabernardy/LuxGPT-basedEN) model for legal/knowledge-based question answering.

## Features

- **Model**: `laurabernardy/LuxGPT-basedEN` - A fine-tuned LuxGPT model for English-based legal and knowledge tasks
- **Interface**: Simple chat interface to interact with the model
- **API**: Uses Hugging Face Inference API

## How to Use

1. **Get a Hugging Face Token**: Visit [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) and create a new token with "read" permissions
2. **Add Token**: In the Space settings, add your token as a secret named `HF_TOKEN`
3. **Ask Questions**: Type your question and get answers from LuxGPT

## Example Questions

- "What are the key principles of contract law?"
- "Explain the concept of due diligence."
- "What is the legal definition of negligence?"

## Technical Details

This Space uses the Hugging Face Inference API to run the LuxGPT-basedEN model. The model is designed for:

- Legal knowledge retrieval
- Question answering
- Text generation for legal contexts

## Model Card

Model: [laurabernardy/LuxGPT-basedEN](https://huggingface.co/laurabernardy/LuxGPT-basedEN)

- **License**: Apache 2.0
- **Base Model**: LuxGPT
- **Fine-tuned for**: Legal and knowledge-based English tasks
- **Size**: ~7B parameters

## Cairn Integration

This demo can be integrated with [Cairn Private Knowledge](https://github.com/saintus-create/cairn-private-knowledge) by:

1. Setting the AI provider to Hugging Face:
   ```bash
   CAIRN_AI_PROVIDER=huggingface
   HUGGINGFACE_API_KEY=your_token_here
   CAIRN_AI_MODEL=laurabernardy/LuxGPT-basedEN
   ```

2. The Cairn app will automatically use the Hugging Face Inference API

## Local Development

To run locally:

```bash
# Install dependencies
pip install -r requirements.txt

# Set your Hugging Face token
export HF_TOKEN=your_token_here

# Run the app
python app.py
```

The app will be available at http://localhost:7860
