import parsers.json.main as json_parser
from parsers.args.arg_parser import ArgParser

arg_parser = ArgParser()

print(json_parser.parse(arg_parser.args.file))