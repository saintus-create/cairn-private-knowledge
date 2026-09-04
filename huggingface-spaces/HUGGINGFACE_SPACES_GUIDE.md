# Hugging Face Spaces for Cairn AI

This directory contains demo Hugging Face Spaces that can be deployed to showcase AI models compatible with Cairn Private Knowledge.

## Available Spaces

### 1. LuxGPT-basedEN Legal AI Demo

**Location:** `huggingface-spaces/luxgpt-demo/`

A Streamlit-based demo showcasing the [LuxGPT-basedEN](https://huggingface.co/laurabernardy/LuxGPT-basedEN) model for legal knowledge and question answering.

#### Features

- Chat interface for legal Q&A
- Configurable temperature
- Example prompts for legal questions
- Integration instructions for Cairn

#### Files

- `app.py` - Main Streamlit application
- `requirements.txt` - Python dependencies
- `huggingface.yml` - Space configuration
- `README.md` - Documentation
- `.gitignore` - Git ignore rules

## How to Deploy

### Method 1: Using Hugging Face CLI

```bash
# Install the Hugging Face CLI
curl -LsSf https://hf.co/cli/install.sh | bash

# Login to Hugging Face
hf auth login

# Clone this repository
cd cairn-private-knowledge
git clone https://huggingface.co/spaces/your-username/luxgpt-demo
cd huggingface-spaces/luxgpt-demo

# Create a new Space
hf space create luxgpt-demo --type streamlit --python_version 3.11

# Push the files
git add .
git commit -m "Initial LuxGPT demo"
git push
```

### Method 2: Manual Upload via Web UI

1. Go to [https://huggingface.co/spaces](https://huggingface.co/spaces)
2. Click "Create new Space"
3. Select "Streamlit" as the SDK
4. Enter Space name: `luxgpt-demo`
5. Upload the files from `huggingface-spaces/luxgpt-demo/`
6. Go to Space Settings > Secrets and add:
   - Key: `HF_TOKEN`
   - Value: Your Hugging Face token (from https://huggingface.co/settings/tokens)

## Configuring Cairn to Use LuxGPT-basedEN

To use LuxGPT-basedEN in Cairn Private Knowledge:

### Environment Variables

Add to your `.env` file:

```bash
# AI Provider Configuration for Hugging Face
CAIRN_AI_PROVIDER=huggingface
HUGGINGFACE_API_KEY=your_huggingface_token_here
CAIRN_AI_BASE_URL=https://api-inference.huggingface.co
CAIRN_AI_MODEL=laurabernardy/LuxGPT-basedEN
```

### Without Environment Variables

Cairn will auto-detect Hugging Face if `HUGGINGFACE_API_KEY` is set.

## Supported AI Providers in Cairn

Cairn now supports the following AI providers:

| Provider | Environment Variable | Default Model |
|----------|---------------------|---------------|
| Hugging Face | `HUGGINGFACE_API_KEY` | `laurabernardy/LuxGPT-basedEN` |
| Mistral AI | `MISTRAL_API_KEY` | `mistral-small-latest` |
| Codestral | `CODESTRAL_API_KEY` | `codestral-2508` |
| Groq | `GROQ_API_KEY` | `openai/gpt-oss-120b` |
| OpenRouter | `CAIRN_AI_API_KEY` | `openai/gpt-4o-mini` |
| Custom | `CAIRN_AI_API_KEY` | `openrouter/free` |

## API Endpoint Compatibility

The `invokeAI` function in Cairn automatically handles different API formats:

- **Hugging Face**: Uses `/models/{model_name}` endpoint with both chat and text generation formats
- **Mistral/Codestral/Groq/OpenRouter**: Uses OpenAI-compatible `/chat/completions` endpoint

## Model Recommendations

For legal knowledge applications like Cairn:

### Hugging Face Models
- `laurabernardy/LuxGPT-basedEN` - Fine-tuned for legal tasks
- `mistralai/Mistral-7B-Instruct-v0.2` - General purpose, good for legal Q&A
- `mistralai/Mixtral-8x7B-Instruct-v0.1` - More capable, higher quality

### Mistral AI Models
- `mistral-small-latest` - Fast and efficient
- `mistral-medium-latest` - More accurate
- `mistral-large-latest` - Most capable

## Example: Using Different Models

To use a different Hugging Face model:

```bash
CAIRN_AI_PROVIDER=huggingface
HUGGINGFACE_API_KEY=your_token
CAIRN_AI_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

## Testing the Space Locally

```bash
# Navigate to the Space directory
cd huggingface-spaces/luxgpt-demo

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your Hugging Face token
export HF_TOKEN=your_token_here

# Run the app
streamlit run app.py
```

The app will be available at http://localhost:8501

## Creating Custom Spaces

To create a new Space for a different model:

1. Create a new directory in `huggingface-spaces/`
2. Add `app.py` with your Streamlit code
3. Add `requirements.txt` with dependencies
4. Add `huggingface.yml` with Space configuration
5. Add `README.md` with documentation
6. Deploy using one of the methods above

## Contributing

If you create a new Space, please:
1. Add it to this directory
2. Update this guide with information about the new Space
3. Include clear instructions for deployment and usage
4. Add configuration examples for Cairn integration
