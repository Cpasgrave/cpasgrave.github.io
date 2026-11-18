def positive_to_negative(b):
    return [*map(int,f"{int(''.join(map(str,b)),2)-(1<<len(b)):b}"[-len(b):])]