class Sudoku(object):
    def __init__(s,d):
        s.d = d
    def is_valid(s):
        n = len(s.d)
        r,t = range(n),int(n**.5)
        if any(len(e)!=n for e in s.d) or any(type(e)not in(int,float)for r in s.d for e in r): return False
        return all({*s.d[i]}=={*[*zip(*s.d)][i]}=={*sum([s.d[i//t*t+j][i%t*t:i%t*t+t]for j in r[:t]],[])}=={*r}-{0}|{n}for i in r)
