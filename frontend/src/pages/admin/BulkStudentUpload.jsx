import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Layout from '../../components/Layout';
import { 
  Upload, FileSpreadsheet, FileText, CheckCircle, 
  AlertCircle, Trash2, Download, Play, RefreshCw 
} from 'lucide-react';

const BulkStudentUpload = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { status, message, results }
  const [progress, setProgress] = useState(0);

  // 1. Handle Excel Parsing
  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);
      
      const mappedData = json.map(row => ({
        name: row.Name || row.name || '',
        email: row.Email || row.email || '',
        registerNumber: String(row['Register Number'] || row.registerNumber || ''),
        department: row.Department || row.department || '',
        block: row.Block || row.block || '',
        roomNumber: row.Room || row.roomNumber || '',
        parentPhone: String(row['Parent Phone'] || row.parentPhone || '')
      }));
      
      setData(mappedData);
    };
    reader.readAsBinaryString(file);
  };

  // Handle Word files - guide user to use Excel template instead
  const parseWord = (file) => {
    setUploadStatus({ 
      status: 'error', 
      message: 'Word (.docx) parsing requires an extra library. Please use the Excel template (Download button above) for the best experience. Excel uploads are fully supported! 📊' 
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      parseExcel(file);
    } else if (file.name.endsWith('.docx')) {
      parseWord(file);
    } else {
      setUploadStatus({ status: 'error', message: 'Unsupported file format. Please use Excel (.xlsx) or Word (.docx).' });
    }
  };

  const handleUpload = async () => {
    if (data.length === 0) return;
    setLoading(true);
    setUploadStatus(null);
    setProgress(0);

    try {
      const response = await axios.post('/api/auth/bulk-student-upload', { students: data });
      setUploadStatus({ 
        status: 'success', 
        message: response.data.message, 
        results: response.data 
      });
      setData([]); // Clear preview on success
    } catch (err) {
      setUploadStatus({ 
        status: 'error', 
        message: err.response?.data?.message || 'Bulk upload failed.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const removeRow = (index) => {
    setData(prev => prev.filter((_, i) => i !== index));
  };

  const downloadTemplate = () => {
    const template = [
      { Name: 'John Doe', Email: 'john.doe@college.edu', 'Register Number': '21051234', Department: 'IT', Block: 'A', Room: '101', 'Parent Phone': '9876543210' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "Student_Upload_Template.xlsx");
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulk Student Upload</h1>
            <p className="text-sm text-gray-500 mt-1">
              Add multiple students instantly by uploading an Excel or Word student list.
            </p>
          </div>
          <button 
            onClick={downloadTemplate}
            className="flex items-center space-x-2 text-sm font-semibold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download Excel Template</span>
          </button>
        </div>

        {/* Upload Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div 
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all bg-white
                ${data.length > 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}
            >
              <div className={`p-4 rounded-full mb-4 ${data.length > 0 ? 'bg-green-100' : 'bg-blue-50'}`}>
                {data.length > 0 ? <FileSpreadsheet className="h-8 w-8 text-green-600" /> : <Upload className="h-8 w-8 text-blue-600" />}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {data.length > 0 ? `${data.length} Students Parsed` : 'Upload Student List'}
              </h3>
              <p className="text-xs text-gray-500 mb-4 px-4 leading-relaxed">
                Supports Excel (.xlsx, .xls) and Word (.docx). Word files should follow a table format.
              </p>

              {/* Password Info Badge */}
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
                <div className="flex items-center text-amber-800 font-bold text-[10px] uppercase tracking-wider mb-1">
                   <AlertCircle className="h-3 w-3 mr-1" /> Registration Policy
                </div>
                <p className="text-[10px] text-amber-700 leading-tight">
                  Accounts are created with default password:<br/>
                  <span className="font-mono font-bold bg-amber-100 px-1 rounded">S@[RegNo]2026</span>
                </p>
              </div>
              
              <div className="relative w-full">
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.docx" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors">
                  {data.length > 0 ? 'Change File' : 'Select File'}
                </button>
              </div>

              {data.length > 0 && (
                <button 
                  onClick={handleUpload}
                  disabled={loading}
                  className={`mt-4 w-full flex items-center justify-center space-x-2 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                  <span>{loading ? 'Processing Data...' : 'Start Account Generation'}</span>
                </button>
              )}
            </div>

            {uploadStatus && (
              <div className={`mt-6 p-4 rounded-xl border flex items-start space-x-3 
                ${uploadStatus.status === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {uploadStatus.status === 'success' ? <CheckCircle className="h-5 w-5 mt-0.5" /> : <AlertCircle className="h-5 w-5 mt-0.5" />}
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider">{uploadStatus.status}</p>
                  <p className="text-sm mt-1">{uploadStatus.message}</p>
                  {uploadStatus.results && (
                     <p className="text-xs mt-2 font-medium">
                       ✅ {uploadStatus.results.successful} created | ⏭️ {uploadStatus.results.skipped} skipped (duplicates)
                     </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-700">Student Preview</h3>
                  {data.length > 0 && (
                    <button onClick={() => setData([])} className="text-xs text-red-500 font-semibold hover:text-red-700">Clear All</button>
                  )}
               </div>
               <div className="overflow-x-auto max-h-[600px]">
                 <table className="min-w-full divide-y divide-gray-200 text-sm">
                   <thead className="bg-gray-50 sticky top-0">
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reg No</th>
                       <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                       <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Dept</th>
                       <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                       <th className="px-6 py-3"></th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-100">
                     {data.length === 0 ? (
                       <tr>
                         <td colSpan="5" className="px-6 py-12 text-center text-gray-400">No data to preview. Upload a file to see entries.</td>
                       </tr>
                     ) : data.map((st, idx) => (
                       <tr key={idx} className="hover:bg-gray-50">
                         <td className="px-6 py-4 font-bold text-blue-600">{st.registerNumber}</td>
                         <td className="px-6 py-4 text-gray-700">{st.name}</td>
                         <td className="px-6 py-4">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{st.department}</span>
                         </td>
                         <td className="px-6 py-4 text-gray-500 text-xs">{st.email}</td>
                         <td className="px-6 py-4 text-right">
                            <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                               <Trash2 className="h-4 w-4" />
                            </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BulkStudentUpload;
