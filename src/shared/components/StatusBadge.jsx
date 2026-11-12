import React from 'react';

const StatusBadge = ({ status }) => {
  let bgColor, textColor;

  switch (status) {
    case 'Pending':
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-800';
      break;
    case 'StaffApproved':
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
      break;
    case 'HODApproved':
      bgColor = 'bg-indigo-100';
      textColor = 'text-indigo-800';
      break;
    case 'WardenApproved':
      bgColor = 'bg-emerald-100';
      textColor = 'text-emerald-800';
      break;
    case 'Rejected':
      bgColor = 'bg-red-100';
      textColor = 'text-red-800';
      break;
    default:
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-800';
  }

  const getDisplayText = () => {
      if(status === 'StaffApproved') return 'Staff Approved';
      if(status === 'HODApproved') return 'HOD Approved';
      if(status === 'WardenApproved') return 'Fully Approved';
      return status;
  }

  return (
    <div className="flex flex-col items-end">
      <span className={`px-2.5 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full ${bgColor} ${textColor} border border-current border-opacity-20 uppercase tracking-tight`}>
        {getDisplayText()}
      </span>
    </div>
  );
};

export default StatusBadge;
