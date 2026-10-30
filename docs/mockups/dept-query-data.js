/* Data for the Departmental Query Control Tower mock.
 *
 * "august" is REAL: the ten rows of the August issue log circulated by Suruchi Mittar,
 * classified into raised-by / at-fault / root cause. That log carries no dates and no
 * cost per issue, so age, SLA and leakage are deliberately left unknown (null) rather
 * than invented — the gaps are themselves a finding for the Zoho form design.
 *
 * "week" and "month" are ILLUSTRATIVE, seeded from the patterns in Planning_Query,
 * Dispatch_Failure and the CHI TAT / SLA alignment sheets.
 */

const COLOR = {
  Design:       'var(--d-design)',
  Factory:      'var(--d-factory)',
  Installation: 'var(--d-install)',
  Services:     'var(--d-services)',
  CRM:          'var(--d-crm)'
};

const RS = '₹';

const DATA = {
  month: {
    label:'This Month', actual:false,
    kpi:{open:86, openD:['up','+14 vs last month'],
         sla:31,    slaD:['up','36% of open queries'],
         tat:17.4,  tatD:['down','-2.1 days vs last month']},
    leak:18.4,
    acct:[
      {d:'Design',raised:9,fault:41},
      {d:'Factory',raised:14,fault:21},
      {d:'Installation',raised:34,fault:15},
      {d:'Services',raised:24,fault:6},
      {d:'CRM',raised:5,fault:3}
    ],
    leakage:[{d:'Design',v:9.8},{d:'Factory',v:4.6},{d:'Installation',v:2.7},{d:'Services',v:0.9},{d:'CRM',v:0.4}],
    dept:{
      Design:{open:41,sla:18,tat:21.3,leak:9.8},
      Factory:{open:21,sla:8,tat:19.6,leak:4.6},
      Installation:{open:15,sla:4,tat:12.1,leak:2.7},
      Services:{open:6,sla:1,tat:7.4,leak:0.9}
    },
    rc:[
      {n:'Incomplete / unclarified drawings',v:24,d:'Design'},
      {n:'Spec mismatch vs approved BOQ',v:17,d:'Design'},
      {n:'Dispatch hold - late approval',v:15,d:'Factory'},
      {n:'Dimension mismatch at site',v:13,d:'Installation'},
      {n:'Client not informed of change',v:11,d:'Design'},
      {n:'Material TAT breach',v:10,d:'Factory'},
      {n:'Site survey / measurement error',v:9,d:'Design'},
      {n:'On-site execution error',v:7,d:'Installation'},
      {n:'Revised drawing after production',v:4,d:'Factory'}
    ],
    locs:[{n:'Hyderabad',v:24},{n:'Delhi',v:18},{n:'Mumbai',v:12},{n:'Bengaluru',v:11},{n:'Kolkata',v:8},{n:'Surat',v:7},{n:'Guntur',v:6}],
    age:[
      {n:'Seema Dhanuka',m:'Material raise, no closure - Factory',d:152,dp:'Factory'},
      {n:'Anuj Aggarwal',m:'Dispatch hold, awaiting Design sign-off',d:109,dp:'Design'},
      {n:'Rohit Khanna',m:'Shutter spec rework - Design',d:64,dp:'Design'},
      {n:'Prestige Gurgaon T-4',m:'Counter dimension mismatch - Installation',d:38,w:1,dp:'Installation'}
    ],
    pipe:[
      {n:'Design',open:41,s:'specs & drawings',l:'9.8L'},
      {n:'Installation',open:15,s:'site readiness',l:'2.7L'},
      {n:'Factory',open:21,s:'production & dispatch',l:'4.6L'},
      {n:'Installation',open:15,s:'fit-out rework',l:'2.7L'},
      {n:'Services',open:6,s:'post-handover',l:'0.9L'}
    ],
    tix:[
      {id:'PQ-2184',c:'Seema Dhanuka',loc:'Chhatarpur',r:'Installation',f:'Factory',rc:'Material TAT breach',a:152,sla:0,l:'2.4L'},
      {id:'DF-0471',c:'Anuj Aggarwal',loc:'Noida 128',r:'Factory',f:'Design',rc:'Late approval to dispatch hold',a:109,sla:0,l:'1.8L'},
      {id:'PQ-2203',c:'Rohit Khanna',loc:'DLF Ph-3',r:'Installation',f:'Design',rc:'Shutter spec mismatch',a:64,sla:0,l:'1.1L'},
      {id:'PQ-2240',c:'Prestige T-4',loc:'Gurgaon',r:'Installation',f:'Design',rc:'Unclarified drawing - island',a:38,sla:0,l:'0.9L'},
      {id:'SV-0912',c:'Mehra Residence',loc:'Vasant Vihar',r:'Services',f:'Installation',rc:'On-site execution error',a:21,sla:0,l:'0.6L'},
      {id:'DF-0498',c:'Bhatia',loc:'Sohna Road',r:'Installation',f:'Factory',rc:'Last-minute dispatch hold',a:12,sla:1,l:'0.4L'},
      {id:'PQ-2261',c:'Kapoor',loc:'Golf Course Ext.',r:'Trustee',f:'Design',rc:'Spec mismatch vs BOQ',a:8,sla:1,l:'0.3L'},
      {id:'SV-0931',c:'Sethi',loc:'Greater Kailash',r:'Services',f:'Services',rc:'Callback not closed',a:4,sla:1,l:'0.1L'}
    ]
  },

  week: {
    label:'This Week', actual:false,
    kpi:{open:23, openD:['up','+3 vs last week'],
         sla:8,    slaD:['up','35% of open queries'],
         tat:11.2, tatD:['down','-1.4 days vs last week']},
    leak:4.6,
    acct:[
      {d:'Design',raised:2,fault:11},
      {d:'Factory',raised:4,fault:6},
      {d:'Installation',raised:9,fault:4},
      {d:'Services',raised:7,fault:2},
      {d:'CRM',raised:1,fault:0}
    ],
    leakage:[{d:'Design',v:2.5},{d:'Factory',v:1.2},{d:'Installation',v:0.7},{d:'Services',v:0.2},{d:'CRM',v:0.0}],
    dept:{
      Design:{open:11,sla:4,tat:13.8,leak:2.5},
      Factory:{open:6,sla:2,tat:12.4,leak:1.2},
      Installation:{open:4,sla:1,tat:9.0,leak:0.7},
      Services:{open:2,sla:1,tat:6.1,leak:0.2}
    },
    rc:[
      {n:'Incomplete / unclarified drawings',v:7,d:'Design'},
      {n:'Dispatch hold - late approval',v:5,d:'Factory'},
      {n:'Spec mismatch vs approved BOQ',v:4,d:'Design'},
      {n:'Client not informed of change',v:3,d:'Design'},
      {n:'Dimension mismatch at site',v:2,d:'Installation'},
      {n:'Site survey / measurement error',v:1,d:'Design'},
      {n:'On-site execution error',v:1,d:'Installation'}
    ],
    locs:[{n:'Hyderabad',v:7},{n:'Delhi',v:5},{n:'Mumbai',v:4},{n:'Bengaluru',v:3},{n:'Kolkata',v:2},{n:'Surat',v:1},{n:'Guntur',v:1}],
    age:[
      {n:'Seema Dhanuka',m:'Material raise, no closure - Factory',d:152,dp:'Factory'},
      {n:'Anuj Aggarwal',m:'Dispatch hold, awaiting Design sign-off',d:109,dp:'Design'},
      {n:'Bhatia - Sohna Road',m:'Dispatch hold called at loading',d:12,w:1,dp:'Factory'}
    ],
    pipe:[
      {n:'Design',open:11,s:'specs & drawings',l:'2.5L'},
      {n:'Installation',open:4,s:'site readiness',l:'0.7L'},
      {n:'Factory',open:6,s:'production & dispatch',l:'1.2L'},
      {n:'Installation',open:4,s:'fit-out rework',l:'0.7L'},
      {n:'Services',open:2,s:'post-handover',l:'0.2L'}
    ],
    tix:[
      {id:'PQ-2261',c:'Kapoor',loc:'Golf Course Ext.',r:'Trustee',f:'Design',rc:'Spec mismatch vs BOQ',a:8,sla:1,l:'0.3L'},
      {id:'DF-0498',c:'Bhatia',loc:'Sohna Road',r:'Installation',f:'Factory',rc:'Last-minute dispatch hold',a:12,sla:1,l:'0.4L'},
      {id:'PQ-2268',c:'Verma',loc:'Ireo Victory Valley',r:'Installation',f:'Design',rc:'Unclarified drawing - tall unit',a:5,sla:1,l:'0.5L'},
      {id:'SV-0931',c:'Sethi',loc:'Greater Kailash',r:'Services',f:'Services',rc:'Callback not closed',a:4,sla:1,l:'0.1L'},
      {id:'DF-0502',c:'Oberoi',loc:'Chattarpur Farms',r:'Factory',f:'Design',rc:'Late approval to dispatch hold',a:3,sla:1,l:'0.2L'}
    ]
  },

  august: {
    label:'August (actual)', actual:true,
    kpi:{open:10, openD:null, sla:null, slaD:null, tat:null, tatD:null},
    leak:null,
    acct:[
      {d:'Design',raised:0,fault:7},
      {d:'Factory',raised:1,fault:0},
      {d:'Installation',raised:5,fault:3},
      {d:'Services',raised:4,fault:0},
      {d:'CRM',raised:0,fault:0}
    ],
    leakage:null,
    dept:{
      Design:{open:7,sla:null,tat:null,leak:null},
      Factory:{open:0,sla:null,tat:null,leak:null},
      Installation:{open:3,sla:null,tat:null,leak:null},
      Services:{open:0,sla:null,tat:null,leak:null}
    },
    rc:[
      {n:'Incomplete / unclarified drawings',v:2,d:'Design'},
      {n:'Client not informed of change',v:2,d:'Design'},
      {n:'Site survey / measurement error',v:2,d:'Design'},
      {n:'On-site execution error',v:2,d:'Installation'},
      {n:'Spec mismatch vs approved BOQ',v:1,d:'Design'},
      {n:'Revised drawing after production',v:1,d:'Design'}
    ],
    locs:[{n:'Hyderabad',v:4},{n:'Delhi',v:2},{n:'Mumbai',v:1},{n:'Kolkata',v:1},{n:'Surat',v:1},{n:'Guntur',v:1}],
    age:[],
    ageNote:'The August log carries no raise or closure dates, so age cannot be computed. Add a date-raised and date-closed field to the Zoho form.',
    pipe:[
      {n:'Design',open:7,s:'specs & drawings',l:null},
      {n:'Installation',open:3,s:'site readiness',l:null},
      {n:'Factory',open:0,s:'production & dispatch',l:null},
      {n:'Installation',open:3,s:'fit-out rework',l:null},
      {n:'Services',open:0,s:'post-handover',l:null}
    ],
    tix:[
      {id:'AUG-01',c:'Mohammad Hadi',loc:'Mumbai',r:'Installation',f:'Design',
       rc:'Spec mismatch vs approved BOQ',a:null,sla:null,l:null,
       issue:'Chimney & hob wrong sizes suggested, resulting in rework at site'},
      {id:'AUG-02',c:'Gaurav Gupta & Megha Jain',loc:'Kolkata',r:'Services',f:'Installation',
       rc:'On-site execution error',a:null,sla:null,l:null,
       issue:'Electrical & plumbing not done as per drawing'},
      {id:'AUG-03',c:'Dr. Pratyusha',loc:'Guntur',r:'Services',f:'Design',
       rc:'Client not informed of change',a:null,sla:null,l:null,
       issue:'Client not informed that POP punning must not be done in backsplash area; sink size wrong in drawing'},
      {id:'AUG-04',c:'Mr. Safal',loc:'Hyderabad',r:'Services',f:'Design',
       rc:'Client not informed of change',a:null,sla:null,l:null,
       issue:'Client not informed that POP punning must not be done in backsplash area'},
      {id:'AUG-05',c:'Richa Malik',loc:'Hyderabad',r:'Installation',f:'Design',
       rc:'Incomplete / unclarified drawings',a:null,sla:null,l:null,
       issue:'Wrong electric drawing issued; filler changed 93mm to 185mm without telling the client; island electric point not as per drawing'},
      {id:'AUG-06',c:'Mr. Sravan',loc:'Hyderabad',r:'Installation',f:'Installation',
       rc:'Site survey / measurement error',a:null,sla:null,l:null,
       issue:'Platform below the cabinet built at 110mm, should be 100mm'},
      {id:'AUG-07',c:'Ajay Jain',loc:'Hyderabad',r:'Services',f:'Installation',
       rc:'On-site execution error',a:null,sla:null,l:null,
       issue:'Platform below cabinet unfinished; POP / putty work not done as required'},
      {id:'AUG-08',c:'Mr. Karan Mashruwala',loc:'Surat',r:'Installation',f:'Design',
       rc:'Incomplete / unclarified drawings',a:null,sla:null,l:null,
       issue:'Wall cabinet drawn at 750mm from counter top; bottom panel not provided'},
      {id:'AUG-09',c:'Tanya Jaiswal',loc:'Delhi',r:'Installation',f:'Design',
       rc:'Site survey / measurement error',a:null,sla:null,l:null,
       issue:'Column on elevation EE drawn at 450mm; actual at site is 490mm'},
      {id:'AUG-10',c:'Sandeep Goel',loc:'Delhi',r:'Factory',f:'Design',
       rc:'Revised drawing after production',a:null,sla:null,l:null,
       issue:'Elevation actually 1300mm, drawn as 700mm; revised drawing shared only after production'}
    ]
  }
};
