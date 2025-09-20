docker run --runtime nvidia --gpus all -v C:\Users\SY399\.cache\huggingface\hub\ --env "HUGGING_FACE_HUB_TOKEN=${HUGGING_FACE_HUB_TOKEN}" -p 8000:8000 --ipc=host vllm/vllm-openai:v0.8.5 --model google/gemma-2b-it --dtype=half

docker run --runtime nvidia --gpus all -v C:\Users\SY399\Documents\projects\docker_folder\starcoder2_7b_22k_ft_80EM:/mnt/model/ --env "TRANSFORMERS_OFFLINE=1" --env "HF_DATASET_OFFLINE=1" -p 8000:8000 --ipc=host vllm/vllm-openai:v0.8.5 --model="/mnt/model/" --dtype=half

