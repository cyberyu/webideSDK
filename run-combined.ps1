Write-Host "Building combined vLLM + Web IDE container..." -ForegroundColor Green
docker build -f DockerTwoTasks -t combined-vllm-webide .

Write-Host "Starting the combined container..." -ForegroundColor Green
docker run --runtime nvidia --gpus all `
  -v "${PWD}\starcoder2_7b_22k_ft_80EM:/mnt/model" `
  -p 8000:8000 `
  -p 3000:3000 `
  --ipc=host `
  combined-vllm-webide

Write-Host "Services running:" -ForegroundColor Yellow
Write-Host "- vLLM API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "- Web IDE: http://localhost:3000" -ForegroundColor Cyan
