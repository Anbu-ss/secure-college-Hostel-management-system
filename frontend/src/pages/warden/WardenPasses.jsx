import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { format } from 'date-fns';
import { ShieldAlert, Users } from 'lucide-react';

const WardenPasses = () => {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPasses();
  }, []);

  const fetchPasses = async () => {
    try {
      const res = await axios.get('/api/gatepass/all');
      setPasses(res.data);
    } catch (error) {
      console.error('Error fetching passes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <ShieldAlert className="mr-3 h-8 w-8 text-primary-600"/>
          Warden Access: All Generated Gate Passes
        </h1>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading passes...</div>
          ) : passes.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No gate passes have been generated yet.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {passes.map((pass) => (
                <li key={pass.PassID} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-start flex-1 min-w-0">
                      <div className="flex-shrink-0 mt-1">
                        <Users className="h-10 w-10 text-primary-600 rounded-full bg-primary-100 p-2" />
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex items-center space-x-2">
                             <h4 className="text-lg font-bold text-gray-900">{pass.Name}</h4>
                             <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Pass #{pass.PassID}</span>
                        </div>
                        <p className="text-sm font-normal text-gray-500">{pass.RegisterNumber} | Block {pass.Block}, Room {pass.RoomNumber}</p>
                        
                        <div className="mt-2 text-sm text-gray-700">
                          <p><strong>Destination:</strong> {pass.Destination}</p>
                        </div>
                        <div className="mt-2 flex space-x-6 text-xs font-semibold text-gray-500">
                           <p>OUT: <span className="text-red-600">{format(new Date(pass.OutTime), 'PPp')}</span></p>
                           <p>RETURN BY: <span className="text-green-600">{format(new Date(pass.ExpectedReturnTime), 'PPp')}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default WardenPasses;
