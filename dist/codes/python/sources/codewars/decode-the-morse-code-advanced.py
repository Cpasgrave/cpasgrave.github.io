def decodeBits(bits):
    step = min([len(i) for i in bits.strip("0").split("0") if i != '']+[len(i) for i in bits.strip("0").split("1") if i != ''])
    return bits[::step].replace("0000000","   ").replace("000"," ").replace("111","-").replace("1",".").replace("0","")

def decodeMorse(morseCode):
    return ' '.join(''.join(MORSE_CODE[letter] for letter in word.split(' ')) for word in morseCode.strip().split('   '))