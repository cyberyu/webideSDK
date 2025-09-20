#!/bin/bash

echo "Building combined vLLM + Web IDE container..."
docker build -f DockerTwoTasks -t combined-vllm-webide .

echo "Starting the combined container..."
docker run --runtime nvidia --gpus all \
  -v "$(pwd)/starcoder2_7b_22k_ft_80EM:/mnt/model" \
  -p 8000:8000 \
  -p 3000:3000 \
  --ipc=host \
  combined-vllm-webide

echo "Services running:"
echo "- vLLM API: http://localhost:8000"
echo "- Web IDE: http://localhost:3000"
