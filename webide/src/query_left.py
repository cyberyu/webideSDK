import argparse

from openai import OpenAI

# Modify OpenAI's API key and API base to use vLLM's API server.
openai_api_key = "EMPTY"
openai_api_base = "http://localhost:8000/v1"


client = OpenAI(
    # defaults to os.environ.get("OPENAI_API_KEY")
    api_key=openai_api_key,
    base_url=openai_api_base,
)

models = client.models.list()
model = models.data[0].id
text = "<fim_prefix>def fib(n):<fim_suffix>    else:\n        return fib(n - 2) + fib(n - 1)<fim_middle>"
# Completion API
completion = client.completions.create(
    model=model,
    prompt=text,
    echo=False,
    n=2,
    logprobs=3,
)

print(completion.choices[0].text)
