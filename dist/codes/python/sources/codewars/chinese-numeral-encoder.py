def to_chinese_numeral(n):

    num = {0:"零", 1:"一", 2:"二", 3:"三", 4:"四", 5:"五", 6:"六", 7:"七", 8:"八", 9:"九", 10:"十", 100:"百", 1000:"千", 10000:"万"    }

    if n<0: return "负"+to_chinese_numeral(-n)
    sn = str(n).split(".")
    dec = "点"+''.join(num[int(d)]for d in sn[1]) if n%1 else ''
    rg = enumerate(map(int,sn[0][::-1]))
    ch = ''.join(num[10**col]*(i!=0 and col>0)+num[i] for col,i in rg)[::-1]
    while '零零' in ch: ch = ch.replace('零零','零')
    return (ch.rstrip('零')[9<n<20:] or '零')+dec
