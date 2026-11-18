def get_middle(s):
    h=len(s)
    if h%2==0:
        return (s[int(h/2-1):int(h/2+1)])
    else:
        return(s[int(h/2+0.5)])