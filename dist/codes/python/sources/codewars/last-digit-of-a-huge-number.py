from functools import reduce as r
def last_digit(lst):
  return r(lambda x,y,f=lambda z:0 if z==0 else z-z//1000*1000 or int(str(z).rstrip('0')[-1]+'00'):f(y**f(x)),lst[::-1],1)%10