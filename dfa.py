## compute_input.py

import sys as sys
import json as json
import pandas as pd

# author: Dominik Krzeminski (dokato)

import numpy as np
import matplotlib.pyplot as plt
import scipy.signal as ss

# detrended fluctuation analysis

#Read data from stdin
def read_in():
    
  lines = sys.stdin.readlines()
  #Since our input would only be having one line, parse our JSON data from that

  return json.loads(lines[0])

  #lines = "[1,2,-4,5,6]" # for testing
  #return json.loads(lines) # for testing

def calc_rms(x, scale):
  """
  windowed Root Mean Square (RMS) with linear detrending.
  
  Args:
  -----
    *x* : numpy.array
      one dimensional data vector
    *scale* : int
      length of the window in which RMS will be calculaed
  Returns:
  --------
    *rms* : numpy.array
      RMS data in each window with length len(x)//scale
  """
  # making an array with data divided in windows
  shape = (x.shape[0]//scale, scale)
  X = np.lib.stride_tricks.as_strided(x,shape=shape)
  # vector of x-axis points to regression
  scale_ax = np.arange(scale)
  rms = np.zeros(X.shape[0])
  for e, xcut in enumerate(X):
    coeff = np.polyfit(scale_ax, xcut, 1)
    xfit = np.polyval(coeff, scale_ax)
    # detrending and computing RMS of each window
    rms[e] = np.sqrt(np.mean((xcut-xfit)**2))
  return rms

def dfa(x, scale_lim=[5,9], scale_dens=0.25, show=False):
  """
  Detrended Fluctuation Analysis - measures power law scaling coefficient
  of the given signal *x*.
  More details about the algorithm you can find e.g. here:
  Hardstone, R. et al. Detrended fluctuation analysis: A scale-free 
  view on neuronal oscillations, (2012).
  Args:
  -----
    *x* : numpy.array
      one dimensional data vector
    *scale_lim* = [5,9] : list of length 2 
      boundaries of the scale, where scale means windows among which RMS
      is calculated. Numbers from list are exponents of 2 to the power
      of X, eg. [5,9] is in fact [2**5, 2**9].
      You can think of it that if your signal is sampled with F_s = 128 Hz,
      then the lowest considered scale would be 2**5/128 = 32/128 = 0.25,
      so 250 ms.
    *scale_dens* = 0.25 : float
      density of scale divisions, eg. for 0.25 we get 2**[5, 5.25, 5.5, ... ] 
    *show* = False
      if True it shows matplotlib log-log plot.
  Returns:
  --------
    *scales* : numpy.array
      vector of scales (x axis)
    *fluct* : numpy.array
      fluctuation function values (y axis)
    *alpha* : float
      estimation of DFA exponent
  """
  # cumulative sum of data with substracted offset
  y = np.cumsum(x - np.mean(x))
  scales = (2**np.arange(scale_lim[0], scale_lim[1], scale_dens)).astype(np.int)
  fluct = np.zeros(len(scales))
  # computing RMS for each window
  prevalue = 1
  for e, sc in enumerate(scales):
    if not np.isnan(np.sqrt(np.mean(calc_rms(y, sc)**2))):
      fluct[e] = np.sqrt(np.mean(calc_rms(y, sc)**2))
      prevalue =  fluct[e]
    else:
      fluct[e] = prevalue
  # fitting a line to rms data
  coeff = np.polyfit(np.log2(scales), np.log2(fluct), 1)
  # print(fluct)
  if show:
    fluctfit = 2**np.polyval(coeff,np.log2(scales))
    plt.loglog(scales, fluct, 'bo')
    plt.loglog(scales, fluctfit, 'r', label=r'$\alpha$ = %0.2f'%coeff[0])
    plt.title('DFA')
    plt.xlabel(r'$\log_{10}$(time window)')
    plt.ylabel(r'$\log_{10}$<F(t)>')
    plt.legend()
    plt.show()
  return scales, fluct, coeff[0]

def main():
  lines = read_in()

  #create a numpy array
  np_lines = np.array(lines)

  df = pd.DataFrame(data=np_lines.flatten())

  x = df[df.columns[0]]

  x = x[x!=0]
  
  x.replace('', np.nan, inplace=True)

  x.dropna()
  
  # using this part to test the DFA parameters for the N of samples above
  # print(y)
  # scales, fluct, alpha = dfa(y, scale_lim=[4,12], scale_dens=0.25,  show=1)
  # computing DFA of signal envelope
  
  # the scale parameters are calculated depending on the time windows we want to compare
  # e.g. for 60Hz (default XSens rate), [4,11] corresponds to the 
  # smallest rate of 2**4 / 60 = 250 ms 
  # and the highest rate of 2 ** 11 / 60 = 34 sec 
  # for a period of 60 sec we then see if the sum of the deviations 
  # repeat on the smallest and on the biggest scale 
  # e.g. [4,12] corresponds to a period longer than the sample (65 sec)
  # while [4,10] corresponds to 17 sec
  # [4,9] is 250 ms to about 8 sec (which is not bad as an attention span,
  # but it doesn't replicate the whole distance so maybe
  # [4,9] and [4,12] should be compared
  # in general 

  y = np.abs(ss.hilbert(x))
  
  scales, fluct, alpha = dfa(y, scale_lim=[4,10], scale_dens=0.1, show=0)
  
  print(alpha)

  # print("DFA exponent: {}".format(alpha))

  ## DEBUG creating a random sample to check parameters
  # n = 10000
  # y = np.random.randn(n)
  # y = np.abs(ss.hilbert(y))


if __name__=='__main__':
  main()
