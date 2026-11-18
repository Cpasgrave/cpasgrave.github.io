def decodeBitsAdvanced(bits):

	bits = bits.strip('0')
	if not bits: return ''
	ones,zeros,prev =[1],[],'1'
	for i,b in enumerate(bits[1:]):
		if b==prev:	
			[zeros,ones][int(b)][-1] += 1
		else:
			[zeros,ones][int(b)] += [1]
			prev = b
	onesort =  sorted(ones)
	min1,max1 = onesort[0],onesort[-1]
	
	if max1/min1<3:
		if not zeros or max1/min(zeros)<3: rate = sum(ones)/len(ones)
		else: rate = sum(ones)/len(ones)/3

	else:
		zerosort = sorted(zeros)
		min0,max0 = zerosort[0],zerosort[-1]
		rate0 = (max0-min0)/7.6
		rate1 = (max1-min1)/3.66
		rate = (rate0+rate1)/2 if len(zeros)>1 else rate1

	return ''.join('.-'[n1>=2*rate]+('',' ','   ')[(n0>=rate*2)+(n0>=rate*5)] for n1,n0 in zip(ones,zeros+[0]))

def decodeMorse(morseCode):
	if morseCode=='': return ''
	return ' '.join(''.join(MORSE_CODE[letter] for letter in word.split(' ')) for word in morseCode.strip().split('   '))
