def list_squared(m,n):
  # This is a fast version, building up a sieve
  # based on the fact that f(n)=f(d1)*f(d2) when d1 and d2 are coprimes and f(n) the sum of its squared divisors
  
  # Memory saving trick: floats are used to store both the sum of squares (or a temporary divisor) and the primality:
  # sss.p => sss = sum of squares, p = primality
  
  sieve,p,res = [0,1]+[0.1]*n,2,[]
  for p in range(1,n+1):
    sp = sieve[p]
    if sp%1:
      # sss.1
      # p is prime
      pp = p*p
      s = pp+1
      sieve[p] = s
      if pp <= n:
        # completing the sieve with multiples of p is needed only if p < sqrt(n)
        for i in range(pp,n+1,p):
          if not sieve[i]%1: 
            # this position is already completed with a divisor
            continue
          if not i%pp:
            # divisor is powered
            prev = [pp,2]
            pw = 3
            div = pp*p
            while not i%div:
              prev = [div,pw]
              pw += 1
              div *= p
            div,pw = prev
            if div == i:
              sieve[i] = sieve[div//p]+div*div           
            else:
              sieve[i] = div
          else:
            sieve[i] = p
    else:
      # sss.0
      # p is not prime
      if sp>p: 
        # the square sum has already been calculated
        s = sp
      else:
        # we need to calculate the square sum from the divisor
        div = int(sieve[p])
        q = p//div
        s = (sieve[q]//1)*(sieve[div]//1)
        sieve[p] = s

    if not s**.5%1 and p>=m: res.append([p,s])
    p += 1
  return res