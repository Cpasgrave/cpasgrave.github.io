def decrypt(text, n):
    if n > 0:
        # ordered is a string of characters with ord from 0 to length of text
        ordered = ''.join([str(chr(i)) for i in range(len(text))])

        # ordered is encrypted, to obtain a list with the original index of each char
        pos = [ord(i) for i in encrypt(ordered, n)]

        # then it's easy to reorder the text by giving each char its original position
        text = ''.join(text[pos.index(i)] for i in range(len(pos)))
    return text


def encrypt(text, n):
    while n > 0:
        n -= 1
        text = text[1::2] + text[::2]
    return text