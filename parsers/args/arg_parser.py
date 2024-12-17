import argparse

class ArgParser():

    def __init__(self):
        self.parser = argparse.ArgumentParser(description='ArgParser for deshittify server')
        self.parser.add_argument('-f', '--file', type=str, help="file to serve")
        self.args = self.parser.parse_args()
