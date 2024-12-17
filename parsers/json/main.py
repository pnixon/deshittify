import json

def parse(input: str):
    with open(input, 'r') as file:
        return json.load(file)