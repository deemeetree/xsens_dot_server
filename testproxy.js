
var beep = require('beepbeep')

var spawn = require('child_process').spawn,
interval_data = getRandomNumberBetween(2300,0,10),
interval_dataString = '';

let should_restart = true
let py = {}
let i = 0



function startPython() {


    py[i] = spawn('python3', ['dfa.py'])

    /* Every time our node application receives data from the python process output stream(on 'data'), 
    we want to convert that received data into a string and append it to the overall interval_dataString.*/
    py[i].stdout.on('data', function(data){
      interval_dataString += data.toString();
      console.log(interval_dataString)
    });
    
    /* Once the stream is done (on 'end') we want to simply log the received data to the console.*/
    py[i].stdout.on('end', function(){

          if (should_restart) {

            console.log('Alpha Component =',interval_dataString);

            if (interval_dataString < 0.42) {
                console.log('negative correlation')
                beep([0,1100,1100,400,400])
            }
            else if (interval_dataString >= 0.42 && interval_dataString <= 0.58) {
                console.log('random white noise movement')
                beep(3)
            }
            else if (interval_dataString > 0.58 && interval_dataString < 0.90) {
                console.log('regular, mundane movement')
                beep([0,1100,1100,400,400])
            }
            else if (interval_dataString > 0.90 && interval_dataString < 1.10) {
                console.log('fractal movement')
                beep(5)
            }
            else if (interval_dataString > 1.10) {
                console.log('organized, highly complex (pathological) movement')
                beep([0,400,400,400,400,400,400,400])
            }

            
            
            
            setTimeout(() => {
              i++
              startPython()
            },2000)

          }
          else {
            console.log("DIE!");
          }
          

    });

    /* Send the data to Python and stringify the data first otherwise our python process wont recognize it*/
    
    py[i].stdin.write(JSON.stringify(interval_data));
    py[i].stdin.end()

}

startPython()

// let the programm run for min. 5sec
setTimeout(() => {
  should_restart = false;
}, 10000);


// Auxiliary functions

function getRandomNumberBetween(number,min,max){
  if (!min) min = 0
  if (!max) max = 1
  if (!number) number = 1

  let random_array = []
  let i = 0

  while (i < number) {
    random_array.push(Math.random()*(max-min+1)+min)
    i++
  }

  return random_array;

}

