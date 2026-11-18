def decrypt(text, n):
    if n > 0:
        ordered = ''.join([str(chr(i)) for i in range(len(text))])
        pos = [ord(i) for i in encrypt(ordered, n)]
        text = ''.join(text[pos.index(i)] for i in range(len(pos)))
    return text


def encrypt(text, n):
    while n > 0:
        n -= 1 ; text = text[1::2] + text[::2]
    return text