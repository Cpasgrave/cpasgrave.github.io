class add(int):
    def __call__(s,n):
        return add(s+n)