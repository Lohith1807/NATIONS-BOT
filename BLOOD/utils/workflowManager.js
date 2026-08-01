const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/workflow.json');

const getWorkflows = () => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}));
    }
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
};

const saveWorkflows = (workflows) => {
    fs.writeFileSync(filePath, JSON.stringify(workflows, null, 2));
};

const addWorkflow = (roleName, workflowContent) => {
    const workflows = getWorkflows();
    workflows[roleName] = workflowContent;
    saveWorkflows(workflows);
};

const getWorkflow = (roleName) => {
    const workflows = getWorkflows();
    return workflows[roleName] || null;
};

const deleteWorkflow = (roleName) => {
    const workflows = getWorkflows();
    if (workflows[roleName]) {
        delete workflows[roleName];
        saveWorkflows(workflows);
        return true;
    }
    return false;
};

const listWorkflows = () => {
    const workflows = getWorkflows();
    return Object.keys(workflows);
};

module.exports = {
    addWorkflow,
    getWorkflow,
    deleteWorkflow,
    listWorkflows,
    getWorkflows
};
