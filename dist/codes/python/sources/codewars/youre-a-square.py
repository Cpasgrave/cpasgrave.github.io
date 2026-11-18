from math import sqrt
def is_square(n):
    return False if n<0 or sqrt(abs(n))%1!=0 else True