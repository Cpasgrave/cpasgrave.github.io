def regex_contains_all(st):
    return (r".*[%s].*" % st) * len("".join(set(st)))