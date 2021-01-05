const { spawn } = require("child_process");

const interval_data = [1, 2, 4, 5, 6, 7]
const interval_response = [];

// use this as exit strategie
var should_restart = true;

let child = []

let i = 0


function start() {

    // spawn python child
    child[i] = spawn("python3", ["compute_input.py"]);

    // would be better to work on buffer objects
    // create on final child/python exit a string out of the buffer
    child[i].stdout.on("data", (data) => {
        interval_response.push(data.toString());
    });

    // listen for the close event
    child[i].stdout.on("end", () => {

        if (should_restart) {

            // feedback
            console.log("Alpha Component =", interval_response.join());

            setTimeout(() => {
                i++
                start();
            }, 1000)

        } else {

            // nope, not now!
            console.log("DIE!", interval_response);
        
            // Do what ever you want with the result here

        }
    });

    // write stuff to python child process
    child[i].stdin.write(JSON.stringify(interval_data));

    child[i].stdin.end()
    

}

start();


// let the programm run for min. 5sec
setTimeout(() => {
    should_restart = false;
}, 5000);