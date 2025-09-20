FROM vllm/vllm-openai:v0.8.5

# Set environment variables
ENV TRANSFORMERS_OFFLINE=1
ENV HF_DATASET_OFFLINE=1

# Expose port 8000
EXPOSE 8000

# Set the entrypoint with the model parameters (model path will be mounted)
CMD ["vllm", "serve", "/mnt/model/", "--dtype", "half", "--host", "0.0.0.0", "--port", "8000"]
