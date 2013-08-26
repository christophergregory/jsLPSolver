//-------------------------------------------------------------------
// SimplexJS
// https://github.com/
// An Object-Oriented Linear Programming Solver
//
// By Justin Wolcott (c)
// Licensed under the MIT License.
//-------------------------------------------------------------------


// Place everything under the Solver Name Space
var Solver = function () {

    "use strict";
    //-------------------------------------------------------------------
    // I'm putting an object inside of this function to house
    // all private methods
    //-------------------------------------------------------------------
    var obj = {};

    // Expose the obj to the world for testing; Maybe remove from production
    this._helpers = obj;

    // John Resig's method for extracting the max value from an Array
    obj.max = function (array) {
        return Math.max.apply(Math, array);
    };

    // John Resig's method for extracting the min value from an Array
    obj.min = function (array) {
        return Math.min.apply(Math, array);
    };

    // Quick and dirty method to round numbers        
    obj.round = function (num, precision) {
        return Math.round(num * Math.pow(10, precision - 0)) / (Math.pow(10, precision - 0));
    };

    // Method to quickly transpose a 2d array
    obj.transpose = function (a) {
        return Object.keys(a[0]).map(function (c) {
            return a.map(function (r) {
                return r[c];
            });
        });
    };

    // Function to see if a number is an integer or not
    obj.isInt = function (num, precision) {
        precision = precision || 5;
        return Math.round(num) === (Math.round(num * 10 * precision) / (10 * precision));
    };

    // Function to check if the solution is integral
    obj.integral = function (model, solution) {
        var key;
        for (key in model.ints) {
            if (model.ints.hasOwnProperty(key)) {
                if (!obj.isInt(solution[key])) {
                    return false;
                }
            }
        }
        return true;
    };

    // Function to find the most fractional variable of the 'ints' constraints
    obj.frac = function (model, solution) {
        var best = 10,
            split = "",
            key;
        for (key in model.ints) {
            if (model.ints.hasOwnProperty(key)) {
                if (best > Math.abs(solution[key] % 1 - 0.5)) {
                    best = Math.abs((solution[key] % 1 - 0.5));
                    split = key;
                }
            }
        }
        return split;
    };


    //-------------------------------------------------------------------
    // Function: spread
    // Puprose: creates a 1d Array of 'l' length filled with '0's except
    //          at position 'p' which becomes 'num'
    //
    // Example: obj.spread(5, 4, 1) === [0,0,0,0,1]
    //-------------------------------------------------------------------
    obj.spread = function (l, p, num) {
        return new Array(l).join().split(",").map(function (e, i) {
            return i === p ? num : 0;
        });
    };

    //-------------------------------------------------------------------
    // Function: slack
    // Purpose: Create the base tableau from a 2d Array of Variables
    //
    //          *note* The objective row is being pre populated with
    //          "0" values so we don't have to worry about creating
    //          it later
    //
    // Example: obj.slack([[1,2,3]
    //                    ,[4,5,6]])
    //          ==>
    //              [[0,1,2,3,1,0],
    //              [0,4,5,6,0,1],
    //              [1,0,0,0,0,0]]
    //
    //-------------------------------------------------------------------
    obj.slack = function (tbl) {
        var len = tbl.length,
            base,
            p,
            i;

        for (i = 0; i < len; i = i + 1) {
            base = i !== (len - 1) ? 1 : 0;
            p = i !== (len - 1) ? 0 : 1;

            tbl[i] = [p].concat(tbl[i].concat(this.spread(len, i, base)));
        }
    };

    //-------------------------------------------------------------------
    // Function: pivot
    // Purpose: Execute pivot operations over a 2d array,
    //          on a given row, and column
    //
    // Example: obj.pivot([[1,2,3],[4,5,6],[7,8,9]],1,2) ==>
    //          [[-0.6,0,0.6],[0.8,1,1.2],[0.6,0,-0.6]]
    //
    //-------------------------------------------------------------------
    obj.pivot = function (tbl, row, col, tracker, transposed) {
        var target = tbl[row][col],
            length = tbl.length,
            width = tbl[0].length,
            rowEl,
            i,
            j;

        tracker[row] = col - 1;
        // Divide everything in the target row by the element @
        // the target column
        for (i = 0; i < width; i = i + 1) {
            tbl[row][i] = (tbl[row][i] / target);
        }


        // for every row EXCEPT the target row,
        // set the value in the target column = 0 by
        // multiplying the value of all elements in the objective
        // row by ... yuck... just look below; better explanation later
        for (i = 0; i < length; i = i + 1) {
            if (i !== row) {
                rowEl = tbl[i][col];
                for (j = 0; j < width; j = j + 1) {
                    tbl[i][j] = ((-rowEl * tbl[row][j]) + tbl[i][j]);
                }
            }
        }
    };


    // NOTE!!!
    // The point of phase 1 and phase 2 are to find where to pivot next;
    // and track what pivots have been made. The grunt work is done by
    // the pivot function.


    //-------------------------------------------------------------------
    // Function: phase1
    // Purpose: Convert a non standard form tableau
    //          to a standard form tableau by eliminating
    //          all negative values in the right hand side
    //
    // Example: obj.phase1(tbl, tracker)...
    //
    //-------------------------------------------------------------------
    obj.phase1 = function (tbl) {
        var rhs,
            row,
            col;

        // Sloppy method for finding the smallest value in the Right Hand Side
        rhs = obj.transpose(tbl).slice(-1)[0].slice(0, -1);

        row = obj.min(rhs);

        // If nothing is less than 0; we're done with phase 1.
        if (row >= 0) {
            return true;
        } else {
            row = rhs.indexOf(row);
            col = obj.min(tbl[row].slice(0, -1));
            if (col >= 0) {
                return true;
            } else {
                col = tbl[row].indexOf(col);
                return {
                    row: row,
                    col: col
                };
            }
        }
    };

    //-------------------------------------------------------------------
    // Function: phase2
    // Purpose: Convert a non standard form tableau
    //          to a standard form tableau by eliminating
    //          all negative values in the right hand side
    //
    // Example: obj.phase1(tbl, tracker)...
    //
    //-------------------------------------------------------------------
    obj.phase2 = function (tbl) {
        var col,
            row,
            quotient,
            length = tbl.length,
            width = tbl[0].length,
            objRow,
            min,
            i,
            dividend;

        // Step 1. Identify the smallest entry in the objective row
        objRow = tbl.slice(-1)[0].slice(0, -1);
        min = obj.min(objRow);

        // Step 2a. If its non-negative, stop. A solution has been found
        if (min >= 0) {
            return true;
        } else {
            // Step 2b. Otherwise, we have our pivot column
            col = objRow.indexOf(min);

            // Step 3a. If all entries in the pivot column are <= 0;
            // stop. The solution is unbounded;

            quotient = [];
            for (i = 0; i < (length - 1); i = i + 1) {
                if (tbl[i][col] > 0.001) {
                    quotient.push((tbl[i][width - 1]) / (tbl[i][col]));
                } else {
                    quotient.push(1e99);
                }
            }
            dividend = obj.min(quotient);
            row = quotient.indexOf(dividend);

            if (dividend > -1 && dividend < 1e99) {
                return {
                    row: row,
                    col: col
                };
            } else {
                return false;
            }
        }
    };

    //-------------------------------------------------------------------
    // Function: optimize
    // Purpose: Convert a non standard form tableau
    //          to a standard form tableau by eliminating
    //          all negative values in the right hand side
    //
    // Example: obj.phase1(tbl, tracker)...
    //
    //-------------------------------------------------------------------
    obj.optimize = function (tbl) {
        var
        tracker = [],
            results = {},
            counter,
            test;

        // Create a transposition of the array to track changes;

        // Execute Phase 1 to Normalize the tableau;
        for (counter = 0; counter < 1000; counter = counter + 1) {
            test = obj.phase1(tbl);
            if (test === true) {
                break;
            } else {
                obj.pivot(tbl, test.row, test.col, tracker);
            }
        }

        // Execute Phase 2 to Finish;
        for (counter = 0; counter < 1000; counter = counter + 1) {
            test = obj.phase2(tbl);
            if (typeof test === "object") {
                obj.pivot(tbl, test.row, test.col, tracker);
            } else {
                if (test === true) {
                    break;
                } else if (test === false) {
                    results.feasible = false;
                    break;
                }
            }

        }
        for (counter = 0; counter < tracker.length; counter = counter + 1) {
            results[tracker[counter]] = tbl[counter].slice(-1)[0];
        }

        results.result = tbl.slice(-1)[0].slice(-1)[0];
        results.feasible = obj.min(obj.transpose(tbl).slice(-1)[0].slice(0, -1)) > -0.001 ? true : false;
        return results;

    };

    //-------------------------------------------------------------------
    //Function: Solve
    //Detail: Main function, linear programming solver
    //-------------------------------------------------------------------
    this.Solve = function (model) {
        var tableau = [], //The LHS of the Tableau
            rhs = [], //The RHS of the Tableau
            cstr = Object.keys(model.constraints), //Array with name of each constraint type
            vari = Object.keys(model.variables), //Array with name of each Variable
            opType = model.opType === "max" ? -1 : 1,
            hsh,
            len,
            z = 0,
            i,
            j,
            x,
            constraint,
            variable,
            rslts;

        //Give all of the variables a self property of 1
        for (variable in model.variables) {
            model.variables[variable][variable] = 1;
            //if a min or max exists in the variables;
            //add it to the constraints
            if (typeof model.variables[variable].max !== "undefined") {
                model.constraints[variable] = model.constraints[variable] || {};
                model.constraints[variable].max = model.variables[variable].max;
            }

            if (typeof model.variables[variable].min !== "undefined") {
                model.constraints[variable] = model.constraints[variable] || {};
                model.constraints[variable].min = model.variables[variable].min;
            }
        }

        cstr = Object.keys(model.constraints); //Array with name of each constraint type
        vari = Object.keys(model.variables); //Array with name of each Variable

        //Load up the RHS
        for (constraint in model.constraints) {
            if (typeof model.constraints[constraint].max !== "undefined") {
                tableau.push([]);
                rhs.push(model.constraints[constraint].max);
            }

            if (typeof model.constraints[constraint].min !== "undefined") {
                tableau.push([]);
                rhs.push(-model.constraints[constraint].min);
            }
        }

        //Load up the Tableau
        for (i = 0; i < cstr.length; i = i + 1) {
            constraint = cstr[i];

            if (typeof model.constraints[constraint].max !== "undefined") {
                for (j = 0; j < vari.length; j = j + 1) {
                    tableau[z][j] = typeof model.variables[vari[j]][constraint] === "undefined" ? 0 : model.variables[vari[j]][constraint];
                }
                z = z + 1;
            }

            if (typeof model.constraints[constraint].min !== "undefined") {
                for (j = 0; j < vari.length; j = j + 1) {
                    tableau[z][j] = typeof model.variables[vari[j]][constraint] === "undefined" ? 0 : -model.variables[vari[j]][constraint];
                }
                z = z + 1;
            }
        }



        //Add an array to the tableau for the Objective Function
        tableau.push([]);

        //Add the Objective Function
        for (j = 0; j < vari.length; j = j + 1) {
            tableau[tableau.length - 1][j] = typeof model.variables[vari[j]][model.optimize] === "undefined" ? 0 : opType * model.variables[vari[j]][model.optimize];
        }

        //Add Slack Variables to the Tableau
        obj.slack(tableau);

        //Add on the Right Hand Side variables
        len = tableau[0].length;
        for (x in rhs) {
            tableau[x][len - 1] = rhs[x];
        }



        rslts = obj.optimize(tableau);
        hsh = {
            feasible: rslts.feasible
        };

        for (x in rslts) {
            if (typeof vari[x] !== "undefined") {
                if (rslts[x] < 0) {
                    hsh.feasible = false;
                }
                hsh[vari[x]] = rslts[x];
            }
        }

        hsh.result = -opType * rslts.result;
        return hsh;
    };


    //-------------------------------------------------------------------
    //Function: MILP
    //Detail: Main function, my attempt at a mixed integer linear programming
    //          solver
    //-------------------------------------------------------------------
    this.MILP = function (model) {
        obj.models = [];
        obj.priors = {};

        var y = 0,
            minmax = model.opType === "min" ? -1 : 1,
            solution = {},
            key,
            intval,
            iHigh,
            iLow,
            branch_a,
            branch_b,
            tmp;
        obj.best = {
            result: -1e99 * minmax,
            feasible: false
        };

        obj.models.push(model);

        while (obj.models.length > 0 && y < 1200) {
            //Pop a model out of the queue
            model = obj.models.pop();
            //Solve it
            solution = this.Solve(model);
            //Is the model both integral and feasible?
            if (obj.integral(model, solution) && solution.feasible) {
                if (solution.result * minmax > obj.best.result * minmax) {
                    obj.best = solution;
                }
                //console.log('Done: ', solution)
            } else if (solution.feasible && solution.result * minmax > minmax * obj.best.result) {
                key = obj.frac(model, solution);
                intval = solution[key];
                iHigh = Math.ceil(intval);
                iLow = Math.floor(intval);
                branch_a = JSON.parse(JSON.stringify(model));
                branch_a.constraints[key] = branch_a.constraints[key] || {};
                branch_a.constraints[key].min = iHigh || 1;

                tmp = JSON.stringify(branch_a);
                if (!obj.priors[tmp]) {
                    obj.priors[tmp] = 1;
                    obj.models.push(branch_a);
                }

                branch_b = JSON.parse(JSON.stringify(model));
                branch_b.constraints[key] = branch_b.constraints[key] || {};
                branch_b.constraints[key].max = iLow || 0;


                tmp = JSON.stringify(branch_b);
                if (!obj.priors[tmp]) {
                    obj.priors[tmp] = 1;
                    obj.models.push(branch_b);
                }

                y = y + 1;
            }
        }
        return obj.best;
    };
};