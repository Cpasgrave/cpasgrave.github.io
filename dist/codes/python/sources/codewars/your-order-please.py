def order(s):
    p = [] ; j = 1
    t = s.split()
    while j < len(t)+1:
         for w in t:
            if str(j) in w:
                p.append(w)
                j += 1
    return " ".join(p)