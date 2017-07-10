(function($) {
    "use strict";
    return {
        events: [
            { event: 'click', selector: '.creator-task', callback: 'createTask' },
            { event: 'change', selector: '.js-job-selector', callback: 'confirmJob' },
            { event: 'change', selector: '.js-task-selector', callback: 'confirmTask' },
            { event: 'click', selector: '.eraser-task', callback: 'resetTask' },
            { event: 'click', selector: '.creator-client', callback: 'createClient' },
            { event: 'click', selector: '.detective-client', callback: 'detectClient' },
            { event: 'click', selector: '.confirmer-client', callback: 'confirmClient' },
            { event: 'click', selector: '.eraser-client', callback: 'resetClient' },
            { event: 'click', selector: '.ship-it', callback: 'shipEight' }
        ],
        // In-memory storage for tasks and jobs
        jobs: {},
        tasks: {},
        staff: {},
        /**
         * Function to create a new WFM task based on the job selected in the dropdown and the ticket number
         * Will also save the connection to the database once chosen
         */
        createTask: function() {
            var doc = this;
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            this.$db.get( "ticket:" + ticketID + ":job" )
            .fail(function(err) {
                alert("Error getting JobID from Database");
                console.error(err);
            })
            .done(function(data) {
                var jobID = data.wfmJobID;
                var jobName = data.wfmJobName;
                var wfmTasksURL = "https://api.workflowmax.com/task.api/list?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
                doc.$request.get(wfmTasksURL)
                .fail(function(err) {
                    alert("Error getting WorkflowMax tasks");
                    console.error(err);
                })
                .done(function(data) {
                    var response = $(data.response);
                    var tasks = $('tasklist task', response);
                    var helpdeskTaskID = 0;
                    tasks.each(function() {
                        var $this = $(this);
                        if ($this.find("name").text().includes("Helpdesk ticket #")) {
                            helpdeskTaskID = $this.find("id").text();
                            if (confirm("This will create a new Task in WorkFlow Max called 'Helpdesk ticket # - "
                                + ticketID + "' under the job '" + jobName + "'. Continue?")) {
                                var wfmURL = "https://api.workflowmax.com/job.api/task?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
                                var taskXML = "<Task>"
                                    + "<Job>" + jobID + "</Job>"
                                    + "<TaskID>" + helpdeskTaskID + "</TaskID>"
                                    + "<EstimatedMinutes>0</EstimatedMinutes>"
                                    + "<Label>" + ticketID + "</Label>"
                                    + "<Description>Generated in Freshdesk</Description>"
                                    + "</Task>";
                                doc.$request.post(wfmURL, {body: taskXML})
                                .fail(function(err) {
                                    alert("Error creating WorkflowMax task");
                                    console.error(err);
                                })
                                .done(function(data) {
                                    var response = $(data.response);
                                    var taskID = $(response).find("id").text();
                                    doc.updateTaskFrontEnd(taskID, "Helpdesk ticket #", ticketID);
                                    doc.confirmNewTask(taskID, "Helpdesk ticket #", ticketID);
                                    doc.assignAgentToTask(jobID, taskID);
                                });
                            }
                        }
                    });
                    if (helpdeskTaskID === 0) {
                        alert("No Helpdesk Ticket Task found!");
                    }
                });
            });
        },
        /**
         * Task to create a skeleton Client in Workflow Max from the contact screen. At the moment, you have to do this
         * from a contact as you can't host a widget on a company. This will set the contact you are set on as the
         * primary contact in WFM.
         */
        createClient: function() {
            var doc = this;
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title; // Naughty hack
            /** global: domHelper */
            var contact = domHelper.contact.getContactInfo().user;

            if (confirm("This will create a new Client in WorkFlow Max called '" + hackCompanyName + "' with "
                + contact.name + " as the primary contact. Continue?")) {
                var wfmURL = "https://api.workflowmax.com/client.api/add?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
                var clientXML = "<Client>"
                    + "<Name>" + hackCompanyName + "</Name>"
                    + "<Contacts>"
                    + "<Contact>"
                    + "<Name>" + contact.name + "</Name>"
                    + "<Email>" + contact.email + "</Email>"
                    + "</Contact>"
                    + "</Contacts>"
                    + "</Client>";
                this.$request.post(wfmURL, {body: clientXML})
                .done(function(data) {
                    var response = $(data.response);
                    console.error(response);
                    var wfmClient = $('Client', response);
                    var wfmClientID = $(wfmClient).children('ID').first().text();
                    var wfmClientName = $(wfmClient).children('Name').first().text();
                    doc.updateClientFrontEnd(wfmClientID, wfmClientName);
                    doc.confirmClient();
                })
                .fail(function(err) {
                    alert("Error creating WorkflowMax client");
                    console.error(err);
                });
            }
        },
        /**
         * This uses a bit of stab-in-the-dark technique to try and guess the appropriate WFM Client if it already exists
         */
        detectClient: function() {
            var doc = this;
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title;
            var wfmURL = "https://api.workflowmax.com/client.api/search?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>&query=" + hackCompanyName;
            this.$request.get(wfmURL)
            .done(function(data) {
                var response = $(data.response);
                var wfmClient = $('Clients', response).children().first();
                if (!wfmClient.length) {
                    var header = doc.$container.getElementsByClassName("header-client")[0];
                    $(header).text("Unable to detect client.");
                    return;
                }
                var wfmClientID = $(wfmClient).children('ID').first().text();
                var wfmClientName = $(wfmClient).children('Name').first().text();
                doc.updateClientFrontEnd(wfmClientID, wfmClientName);
                doc.showByClass("confirmer-client");
            })
            .fail(function(err) {
                alert("Error detecting WorkflowMax client");
                console.error(err);
            });
        },
        /**
         * Function to call WFM and fill the Job Dropdown based on the Client that raised the ticket
         * @param wfmClientID
         */
        populateJobDropdown: function(wfmClientID) {
            var wfmURL = "https://api.workflowmax.com/job.api/client/" + wfmClientID + "?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            var dropdownContent = this.$container.getElementsByClassName("js-job-selector")[0];
            var doc = this;
            this.$request.get(wfmURL)
                .done(function(data) {
                    var response = $(data.response);
                    var jobs = $('Jobs Job', response);
                    jobs.each(function() {
                        var $this = $(this);
                        if ($this.find('State').text() === "In Progress") {
                            var wfmJobID = $this.children('ID').text();
                            var wfmJobName = $this.children('Name').text();
                            doc.jobs[wfmJobID] = wfmJobName;
                            var dropdownOption = $('<option>', {
                                'value': wfmJobID
                            });
                            dropdownOption.text(wfmJobID + ": " + wfmJobName);
                            $(dropdownContent).append(dropdownOption);
                        }
                    });
                    $(dropdownContent).children().first().text('Please select a Job');
                    $(dropdownContent).select2();
                })
                .fail(function(err) {
                    alert("Error populating WorkflowMax Job dropdown");
                    console.error(err);
                });
        },
        /**
         * Function to populate the Task dropdown based on the Job selected in the dropdown above.
         * @param wfmJobID
         */
        populateTaskDropdown: function(wfmJobID) {
            var wfmURL = "https://api.workflowmax.com/job.api/get/" + wfmJobID + "?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            var dropdownContent = this.$container.getElementsByClassName("js-task-selector")[0];
            var doc = this;
            this.$request.get(wfmURL)
                .done(function(data) {
                    var response = $(data.response);
                    var tasks = $('Tasks Task', response);
                    tasks.each(function() {
                        var $this = $(this);
                        var wfmTaskID = $this.children('ID').text();
                        var wfmTaskName = $this.children('Name').text();
                        doc.tasks[wfmTaskID] = wfmTaskName;
                        var dropdownOption = $('<option>', {
                            'value': wfmTaskID
                        });
                        dropdownOption.text(wfmTaskID + ": " + wfmTaskName);

                        if ($this.children('Label') !== undefined) {
                            dropdownOption.text += $this.children('Label').text();
                        }
                        $(dropdownContent).append(dropdownOption);
                    });
                    $(dropdownContent).children().first().text('Please select a Task');
                    $(dropdownContent).select2();
                })
                .fail(function(err) {
                    alert("Error populating WorkflowMax task dropdown");
                    console.error(err);
                });
        },
        /**
         * Saves the client information to the Freshdesk DB storage. Also hides/shows buttons based on the new
         * arrangement.
         */
        confirmClient: function() {
            var doc = this;
            var wfmLink = this.$container.getElementsByClassName("wfm-client-link")[0];
            /** global: domHelper */
            var companyID = domHelper.contact.getContactInfo().user.customer_id;
            var detectedClientName = wfmLink.dataset.wfmName;
            var detectedClientID = wfmLink.dataset.wfmId;

            this.$db.set( "client:" + companyID,
                { "wfmClientID": detectedClientID, "wfmClientName": detectedClientName })
            .done(function() {
                doc.updateClientFrontEnd(detectedClientID, detectedClientName);
                doc.hideByClass("confirmer-client");
                doc.hideByClass("detective-client");
                doc.hideByClass("creator-client");
                doc.showByClass("eraser-client");
                doc.$container.getElementsByClassName("header-client")[0].innerHTML.replace("detected", "saved");
            })
            .fail(function(err) {
                alert("Error confirming WorkflowMax client");
                console.error(err);
            });
        },
        /**
         * Saves the Job information to the Freshdesk DB storage, updates buttons, populates the task dropdown
         * @param event - the click event ie you picking something in the dropdown
         */
        confirmJob: function(event) {
            var doc = this;
            var wfmJobID = $(event.target).val();
            var wfmJobName = doc.jobs[wfmJobID];
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;

            this.$db.set( "ticket:" + ticketID + ":job",
                { "wfmJobID": wfmJobID, "wfmJobName" : wfmJobName })
                .done(function() {
                    doc.showByClass("creator-task");
                    doc.populateTaskDropdown(wfmJobID);
                })
                .fail(function(err) {
                    alert("Error confirming WorkflowMax job");
                    console.error(err);
                });
        },
        /**
         * Saves the Task information to the Freshdesk DB storage, updates buttons.
         * @TODO hook this into the timekeeper so that it picks it up somehow.
         * @param event - the click event ie you picking something in the dropdown
         */
        confirmTask: function(event) {
            var doc = this;
            var wfmTaskID = $(event.target).val();
            var wfmTaskName = doc.tasks[wfmTaskID];
            if ($(event.target).data('wfm-task-label') !== undefined) {
                var wfmTaskLabel = $(event.target).data('wfm-task-label');
            } else {
                wfmTaskLabel = "";
            }
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;

            this.$db.set( "ticket:" + ticketID + ":task",
                { "wfmTaskID": wfmTaskID, "wfmTaskName": wfmTaskName, "wfmTaskLabel": wfmTaskLabel })
                .done(function() {
                    doc.hideByClass("creator-task");
                    doc.hideByClass("js-wfm-form");
                    doc.showByClass("ship-it");
                    doc.showByClass("eraser-task");
                    doc.updateTaskFrontEnd(wfmTaskID, wfmTaskName, wfmTaskLabel);
                    doc.$container.getElementsByClassName("header-task")[0].innerHTML.replace("detected", "saved");
                })
                .fail(function(err) {
                    alert("Error confirming WorkflowMax job");
                    console.error(err);
                });
        },
        /**
         * Saves a newly created Task to the Freshdesk DB storage, updates buttons
         * @param wfmTaskID
         * @param wfmTaskName
         * @param wfmTaskLabel
         */
        confirmNewTask: function(wfmTaskID, wfmTaskName, wfmTaskLabel) {
            var doc = this;
            if (wfmTaskLabel === undefined) {
                wfmTaskLabel = "";
            }
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;

            this.$db.set( "ticket:" + ticketID + ":task",
                { "wfmTaskID": wfmTaskID, "wfmTaskName": wfmTaskName, "wfmTaskLabel": wfmTaskLabel })
                .done(function() {
                    doc.hideByClass("creator-task");
                    doc.hideByClass("js-wfm-form");
                    doc.showByClass("eraser-task");
                    doc.showByClass("ship-it");
                    doc.updateTaskFrontEnd(wfmTaskID, wfmTaskName, wfmTaskLabel);
                    doc.$container.getElementsByClassName("header-task")[0].innerHTML.replace("detected", "saved");
                })
                .fail(function(err) {
                    alert("Error confirming new WorkflowMax task");
                    console.error(err);
                });
        },
        /**
         * Deletes the DB entry for the client that ties together the WFM client and the Freshdesk Company.
         */
        resetClient: function() {
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title;
            var wfmLink = this.$container.getElementsByClassName("wfm-client-link")[0];
            /** global: domHelper */
            var companyID = domHelper.contact.getContactInfo().user.customer_id;
            var detectedClientName = wfmLink.dataset.wfmName;

            if (confirm("Are you sure you want to erase the connection between the company '" + hackCompanyName
                    + "' and the WorkFlow Max Client '" + detectedClientName + "'?")) {
                this.$db.delete ( "client:" + companyID)
                    .done(function() {
                        location.reload();
                    })
                    .fail(function(err) {
                        alert("Error resetting WorkflowMax client");
                        console.error(err);
                    });
            }
        },
        /**
         * Deletes the DB entry for the task that ties together the WFM task and the Freshdesk ticket.
         */
        resetTask: function() {
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            var ticketSubject = domHelper.ticket.getTicketInfo().helpdesk_ticket.subject;
            var detectedTaskName = this.$container.getElementsByClassName("wfm-task-link")[0].innerHTML;

            if (confirm("Are you sure you want to erase the connection between ticket '"
               + ticketID + ": " + ticketSubject + "' and the WorkFlow Max task '" + detectedTaskName + "'?"
            )) {
                this.$db.delete ( "ticket:" + ticketID + ":task")
                    .done(function() {
                        location.reload();
                    })
                    .fail(function(err) {
                        alert("Error resetting WorkflowMax task");
                        console.error(err);
                    });
            }
        },
        // Helper functions to toggle buttons (usually)
        hideByClass: function(className) {
            this.$container.getElementsByClassName(className)[0].style.display = 'none';
        },
        showByClass: function(className) {
            this.$container.getElementsByClassName(className)[0].style.display = 'inline-block';
        },
        hideWrongButtons: function() {
            /** global: page_type */
            if (page_type == "ticket") {
                this.hideByClass("holder-client");
            } else if (page_type == "contact") {
                this.hideByClass("holder-task");
            }
        },
        /**
         * Checks the Freshdesk DB for stored info about linked Client and Company, updates buttons accordingly
         */
        checkForConnectedClient: function() {
            var doc = this;
            /** global: page_type */
            if (page_type === "contact") {
                /** global: domHelper */
                var clientID = domHelper.contact.getContactInfo().user.customer_id;
            } else if (page_type === "ticket") {
                clientID = domHelper.ticket.getContactInfo().user.customer_id;
            }
            this.$db.get("client:" + clientID)
                .done(function(data) {
                    doc.updateClientFrontEnd(data.wfmClientID, data.wfmClientName);
                    /** global: page_type */
                    if (page_type === "ticket") {
                        doc.populateJobDropdown(data.wfmClientID);
                    }
                    doc.hideByClass("creator-client");
                    doc.hideByClass("detective-client");
                    doc.hideByClass("confirmer-client");
                    doc.showByClass("eraser-client");
                })
                .fail(function() {
                    doc.$container.getElementsByClassName("header-client")[0].innerHTML = "No client connected.";
                    doc.hideByClass("eraser-client");
                });
        },
        /**
         * Checks the Freshdesk DB for stored info about linked Task and Ticket, updates buttons accordingly
         */
        checkForConnectedTask: function() {
            var doc = this;
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            this.$db.get("ticket:" + ticketID + ":task")
            .done(function(data) {
                if (data.wfmTaskID && data.wfmTaskName) {
                    doc.updateTaskFrontEnd(data.wfmTaskID, data.wfmTaskName, data.wfmTaskLabel);
                    doc.hideByClass("creator-task");
                    doc.hideByClass("js-wfm-form");
                    doc.showByClass("eraser-task");
                    doc.showByClass("ship-it");
                }
            })
            .fail(function() {
                doc.$container.getElementsByClassName("header-task")[0].innerHTML = "No task connected.";
            });
        },
        /**
         * Updates app box to reflect detected Client
         * @param wfmClientID
         * @param wfmClientName
         */
        updateClientFrontEnd: function(wfmClientID, wfmClientName) {
            /** global: page_type */
            if (page_type === "ticket") {
                var header = "header-task-client";
            } else if (page_type === "contact") {
                header = "header-client";
            }
            var clientHeader = document.getElementsByClassName(header)[0];
            var clientDetailURL = "https://practicemanager.xero.com/Client/" + wfmClientID + "/Detail";
            var clientLink = $('<a>', {
                'text': wfmClientName,
                'class': "wfm-client-link",
                'href': clientDetailURL,
                'data-wfm-id': wfmClientID,
                'data-wfm-name': wfmClientName
            });

            $(clientHeader).text("Client detected: ");
            $(clientHeader).append(clientLink);
        },
        /**
         * Updates app box to reflect detected Task
         * @param wfmTaskID
         * @param wfmTaskName
         * @param wfmTaskLabel
         */
        updateTaskFrontEnd: function(wfmTaskID, wfmTaskName, wfmTaskLabel) {
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            if (wfmTaskLabel === undefined) {
                wfmTaskLabel = "";
            }
            this.$db.get("ticket:" + ticketID + ":job")
                .done(function(data) {
                    var taskHeader = document.getElementsByClassName("header-task")[0];
                    var taskLinkText = data.wfmJobID + ": " + wfmTaskName + wfmTaskLabel;
                    var wfmTaskURL = "https://my.workflowmax.com/job/jobtaskview.aspx?id=" + wfmTaskID;
                    var taskLink = $('<a>', {
                        'class': "wfm-task-link",
                        'text': taskLinkText,
                        'href': wfmTaskURL
                    });

                    $(taskHeader).text("Task detected: ");
                    $(taskHeader).append(taskLink);
                })
                .fail(function(err) {
                    alert("Error updating task");
                    console.error(err);
                });
        },
        /**
         * Brings in the list of WFM staff so that we can easily map ID to email address.
         */
        detectStaff: function() {
            var doc = this;
            var wfmStafflistURL = "https://api.workflowmax.com/staff.api/list?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            doc.$request.get(wfmStafflistURL)
            .fail(function(err) {
                alert("Error retrieving staff list");
                console.error(err);
            })
            .done(function(data) {
                var response = $(data.response);
                var staff = $('Staff', response);
                $(staff).each(function() {
                    var $this = $(this);
                    var agentEmail = $this.find("email").text();
                    doc.staff[agentEmail.toLowerCase()] = $this.find("id").text();
                });
            });
        },
        /**
         * Assigns the Agent to the WFM task so that they may submit time to it
         * @param wfmJobID
         * @param wfmTaskID
         */
        assignAgentToTask: function(wfmJobID, wfmTaskID) {
            var wfmURL = "https://api.workflowmax.com/job.api/assign?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            /** global: domHelper */
            var agentEmail = domHelper.getAgentEmail();
            var agentID = this.staff[agentEmail.toLowerCase()];
            if (!agentID) {
                alert("No Workflow Max user found for email address: " + agentEmail);
                return;
            }
            var assignAgentXML = "<Job>"
                + "<ID>" + wfmJobID + "</ID>"
                + "<add id='" + agentID + "' task='" + wfmTaskID + "'/>"
                + "</Job>";

            this.$request.put(wfmURL, {body: assignAgentXML})
            .fail(function(err) {
                console.error(err);
            })
            .done(function() {
            });
        },
        /**
         * Magic button to push 8 hours of time against one ticket. Mucho Spaghetti here.
         */
        shipEight: function() {
            var doc = this;
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            var wfmTimesheetURL = "https://api.workflowmax.com/time.api/add?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            this.$db.get("ticket:" + ticketID + ":job")
            .fail(function(err) {
                alert("Couldn't read Job from DB.");
                console.error(err);
            })
            .done(function(data) {
                var jobID = data.wfmJobID;
                doc.$db.get("ticket:" + ticketID + ":task")
                .fail(function(err) {
                    alert("Couldn't read Task from DB.");
                    console.error(err);
                })
                .done(function(data) {
                    var taskName = data.wfmTaskName;
                    if (data.wfmTaskLabel !== undefined) {
                        taskName += data.wfmTaskLabel;
                    }
                    var taskID = data.wfmTaskID;
                    doc.assignAgentToTask(jobID, taskID);
                    /** global: domHelper */
                    var agentEmail = domHelper.getAgentEmail();
                    var agentID = doc.staff[agentEmail.toLowerCase()];
                    var date = new Date();
                    // Hacked together datestring to ensure a) month/day have 2 digits each and b) it fits WFM convention
                    var dateString = "" + date.getFullYear() + ("0" + (date.getMonth() + 1)).slice(-2) + ("0" + date.getDate()).slice(-2);

                    if (confirm("You want to ship 8 hours against the task " + taskName + "?")) {
                        var logTimeXML = "<Timesheet>"
                            + "<Job>" + jobID + "</Job>"
                            + "<Task>" + taskID + "</Task>"
                            + "<Staff>" + agentID + "</Staff>"
                            + "<Date>" + dateString + "</Date>"
                            + "<Minutes>480</Minutes>"
                            + "<Note>Shipped from Freshdesk</Note>"
                            + "</Timesheet>";
                        doc.$request.post(wfmTimesheetURL, {body: logTimeXML})
                        .done(function() {
                            var icons = $(doc.$container).find('i.ship-it-icon');
                            $(icons).each(function() {
                                var $this = $(this);
                                $this.attr('class', 'fa fa-ship');
                            });
                            $(doc.$container).find('.js-ship-it-text').text("Shipped");
                        })
                        .fail(function(err) {
                            alert("Error updating WorkflowMax task for full day");
                            console.error(err);
                        });
                    }
                });
            });
        },
        /**
         * Function what makes it go like.
         */
        initialize: function() {
            this.hideWrongButtons();
            /** global: page_type */
            if (page_type === "ticket") {
                this.checkForConnectedTask();
            }
            this.checkForConnectedClient();
            this.detectStaff();

        }
    };
})(jQuery);
