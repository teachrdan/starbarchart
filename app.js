const {BarChart, Bar, XAxis, YAxis, Tooltip} = Recharts;

class SelectDepartment extends React.Component {
	constructor(props) {
		super(props);
		this.handleClick = this.handleClick.bind(this);
	}

	handleClick(event) {
		const selectedDept = event.target.innerText;
		this.props.chooseDept(selectedDept);
	}

	render() {
		if (this.props) {
			return (
				<div className="options">
					{
						this.props.data.map(deptName => {
							return (
								<option
									onClick={this.handleClick}
									className={this.props.dept===deptName ? 'selected' : ''}
									>
									{deptName}
								</option>
							)
						})
					}
				</div>
			);
		} else {
			return <p>loading...</p>
		}
	}
}

class CustomTooltip extends React.Component {
	render() {
		if (this.props) {
			const {payload, label} = this.props;
			const payrollString = '$' + payload[0].payload.payroll.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			const avgString = '$' + payload[0].payload.avg.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			// NOTE: Quick and dirty implementation; would use a function (and ==='s) to calculate this in production
			const quarterNum = (label[6]==1) ? 1 : (label[6]==4) ? 2 : (label[6]==7) ? 3 : 4;
			const quarterString = 'Q' + quarterNum + ' ' + label.substring(0,4);

			return (
				<div className="custom-tooltip">
					<p className="intro">{quarterString}</p>
					<p className="label">Headcount: {payload[0].value}</p>
					<p className="label">Payroll: {payrollString}</p>
					<p className="label">Avg Salary: {avgString}</p>
				</div>
			);
		}
		return null;
	}
}

class EmployeesByQuarterBarChart extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			selected: false
		};
		this.toggleSelected = this.toggleSelected.bind(this);
	};

	toggleSelected(event) {
		this.setState({
			selected: !this.state.selected
		});
	};

	render () {
		return (
			<BarChart
				className="chart"
				width={900}
				height={400}
				data={this.props.data[this.props.dept]}
				margin={{top: 25, right: 0, left: 25, bottom: 25}}
				>
				<XAxis
					dataKey="quarter"
					fontFamily="sans-serif"
					label="Quarters"
				/>
				<YAxis
					dataKey="headcount"
				/>
				<Tooltip
					content={<CustomTooltip />}
				/>
				<Bar
					dataKey="headcount"
					fontFamily="sans-serif"
				/>
			</BarChart>
		)
	}
}

class Application extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			avgSalaryToday: 'Click Dept to See',
			dataObj: {},
			departmentNames: [],
			dept: 'Whole Company',
			error: '',
			fetching: false
		};
		this.chooseDept = this.chooseDept.bind(this);
	};

	chooseDept(dept) {
		const avgSalaryToday = this.calculateAvgSalaryToday(dept);
		this.setState({
			avgSalaryToday,
			dept
		});
	};

	calculateAvgSalaryToday(deptStr) {
		const avgSalaryToday = this.state.dataObj[deptStr].reduce((acc, item) => {
			const avgString = '$' + item.avg.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			return (new Date() > new Date(item.quarter)) ? avgString : acc;
		}, 'Bad Data');

		return avgSalaryToday;
	};

	render() {
		if (!this.state.fetching) {
			return <div>
				<h1>Headcount and Payroll by Quarter: {this.state.dept}</h1><br />
				<h2>Current Average Salary for {this.state.dept}: {this.state.avgSalaryToday}</h2>
				<h2>Select department below; hover over chart for details</h2>
				<SelectDepartment data={this.state.departmentNames} chooseDept={this.chooseDept} dept={this.state.dept} />
				<EmployeesByQuarterBarChart class="chart" data={this.state.dataObj} dept={this.state.dept} />
			</div>;
		} else {
			return <p>Loading data...</p>
		}
	};

	componentDidMount() {
		this.setState({fetching: true});
		let context = this;

		fetch('https://rawgit.com/howespt/2e463579357415e299452aaf8897f973/raw/9aace3355b6e862908172fb360693666bf7b2521/example_data.json', {method: 'GET'})
			.then(res => res.text())
			.then(res => {
				// change response string to correctly formatted JSON string before parsing
				let employeesStr = res.replace(/'/g, '"');
				employeesStr = employeesStr.replace(/date/g, '"date"');
				employeesStr = employeesStr.replace(/dept/g, '"dept"');
				employeesStr = employeesStr.replace(/employee/g, '"employee"');
				employeesStr = employeesStr.replace(/salary/g, '"salary"');

				// end up with an array of all employee objects sorted by date
				const employeesArr = [...JSON.parse(employeesStr)];
				employeesArr.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

				// create array of all department names
				// NOTE: tidier implementation w/ [...new Set(arr)] doesn't seem to work in Codepen
				let departmentNames = Array.from(new Set(employeesArr.map(employee => employee.dept)));
				departmentNames.unshift('Whole Company');
				const dataObj = {};

				// create array of number of employees by quarter and payroll by quarter
				const quarters = ['2015-01-01', '2015-04-01', '2015-07-01', '2015-10-01', '2016-01-01', '2016-04-01', '2016-07-01', '2016-10-01', '2017-01-01', '2017-04-01', '2017-07-01', '2017-10-01'];

				departmentNames.forEach(dept => {
					dataObj[dept] = quarters.map(quarter => ({quarter, payroll: 0, headcount: 0}));
				});
				let employees = [];
				const employeesByID = new Map();

				employeesArr.forEach(employee => {
					const eID = employee.employee;
					const eDept = employee.dept;
					const quarterIdx = quarters.reduce((acc, quarter, idx) => (new Date(employee.date)>=new Date(quarter)) ? idx : acc, 0);
					const allThisQuarter = dataObj['Whole Company'][quarterIdx];
					const deptThisQuarter = dataObj[eDept][quarterIdx];

					// handle case of "skipped" quarters - populate them with the prior quarter's numbers
					if (quarterIdx>0) {
						for (let i=1; i<=quarterIdx; i++) {
							departmentNames.forEach(dept => {
								const currDept = dataObj[dept];
								if (!currDept[i].initialized) {
									currDept[i].payroll = currDept[i-1].payroll;
									currDept[i].headcount = currDept[i-1].headcount;
									currDept[i].initialized = true;
								}
							});
						}
					}

					// if the employee is already being tracked, update dept headcount and payroll
					if (employeesByID.has(eID)) {
						const oldDept = employeesByID.get(eID).dept;
						const oldSalary = employeesByID.get(eID).salary;

						// update dept headcounts
						dataObj[oldDept][quarterIdx].headcount--;
						dataObj[employee.dept][quarterIdx].headcount++;

						// now add employee's current salary to their current dept
						dataObj[oldDept][quarterIdx].payroll -= oldSalary;
						deptThisQuarter.payroll += employee.salary;
						allThisQuarter.payroll += (employee.salary - oldSalary);
					}
					// if it's a new employee, start tracking them and update the quarter
					else {
						deptThisQuarter.headcount++;
						deptThisQuarter.payroll += employee.salary;
						allThisQuarter.payroll += employee.salary;
					}

					// updates / adds employee's salary and dept
					employeesByID.set(eID, {salary: employee.salary, dept: eDept});
					allThisQuarter.headcount = employeesByID.size;
					allThisQuarter.initialized = true;
					deptThisQuarter.initialized = true;
				});

				for (let key in dataObj) {
					dataObj[key].forEach(item => {
						item.avg = (item.payroll!==0) ? Math.round(item.payroll/item.headcount) : 0;
						delete item.initialized; // a bit of data cleanup
					});
				}

				// generate array of most current employee data
				const currEmployeeObj = {};
				employeesArr.forEach(employee => {
					const employeeID = employee.employee;
					if (!currEmployeeObj[employeeID]) {
						currEmployeeObj[employeeID] = employee;
					} else {
						let employeeObjDateUTC = new Date(currEmployeeObj[employeeID].date).getTime();
						let employeeDateUTC = new Date(employee.date).getTime();
						if (employeeDateUTC > employeeObjDateUTC) currEmployeeObj[employeeID] = employee;
					}
				});

				for (let ID in currEmployeeObj) {
					employees.push(currEmployeeObj[ID]);
				}

				let departmentData = [];
				departmentNames.forEach(departmentName => {
					let deptInfo = {
						name: departmentName,
						headcount: 0,
						payroll: 0,
						avgSalary: 0
					};

					employees.forEach(employee => {
						if (employee.dept===departmentName) {
							deptInfo.headcount++;
							deptInfo.payroll += employee.salary;
						}
					});

					deptInfo.avgSalary = (deptInfo.payroll / deptInfo.headcount);
					departmentData.push(deptInfo);
				});

				const avgSalaryToday = '$' + dataObj['Whole Company'][10].avg.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
				context.setState({
					avgSalaryToday,
					dataObj,
					departmentNames,
					fetching: false
				});
			})
			.catch(res => {
				context.setState({error: res.data, fetching: false});
			});
	};
}
/*
 * Render the above component into the div#app
 */
ReactDOM.render(<Application />, document.getElementById('app'));
