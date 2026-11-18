def spin_words(s):
    r = []
    for w in s.split(): r.append(w[::-1] if len(w) > 4 else w)
    return " ".join(r)