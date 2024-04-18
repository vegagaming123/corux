import React, { memo, useEffect, useState, useCallback } from "react";
import { Box, Container } from "@mui/material";
import { AgGridReact } from "ag-grid-react";
import { useDispatch, useSelector } from "react-redux";
import {
  getResultList,
  selectResultCurrentPage,
  selectResultData,
  selectResultLoading,
  selectResultPage,
  setWinnerCurrentPage,
} from "../../Feature/Result/resultSlice";
import AgGridPagination from "../UI/AgGridPagination";
import TableSkeleton from "../UI/TableSkeleton";
import { blue } from "@mui/material/colors";

const WinnerTable = () => {
  const dispatch = useDispatch();
  const data = useSelector(selectResultData);
  const page = useSelector(selectResultPage);
  const currentPage = useSelector(selectResultCurrentPage);
  const loading = useSelector(selectResultLoading);

  const [gridApi, setGridApi] = useState(null);
  function onGridReady(params) {
    setGridApi(params.api);
  }

  useEffect(() => {
    if (!data) {
      dispatch(getResultList({ page: 1, size: 10 }));
    }
  }, []);

  const paginationHandler = (e, page) => {
    dispatch(setWinnerCurrentPage(page));
    dispatch(getResultList({ page, size: 10 }));
  };

  const columnDefs = [
    { headerName: "Period", field: "game_id", maxWidth: 185 },
    {
      headerName: "Color",
      field: "color_who_won",
      maxWidth: 100,
      cellRenderer: ({ value }) => {
        return (
          <Box
            sx={{
              height: 20,
              width: 20,
              borderRadius: "50%",
              background:
                value.length === 2
                  ? `linear-gradient(90deg, ${value[0]} 50%, ${value[1]} 50%)`
                  : value[0],
            }}
          />
        );
      },
    },
    { headerName: "Number", field: "number_who_won", maxWidth: 100 },
  ];

  const getRowStyle = (params) => {
    if (params.node.rowIndex % 2 === 0) {
      return { backgroundColor: blue[100] };
    } else {
      return null;
    }
  };

  return (
    <Box>
      {loading ? (
        <TableSkeleton />
      ) : (
        <Box display="flex" flexDirection="column" gap={2} alignItems="stretch">
          <Box
            className="ag-theme-quartz"
            sx={{ height: "100%", width: "100%" }}
          >
            <AgGridReact
              onGridReady={onGridReady}
              rowData={data}
              columnDefs={columnDefs}
              domLayout="autoHeight"
              getRowStyle={getRowStyle}
            />
          </Box>
          <Box>
            <AgGridPagination
              count={page}
              onChange={paginationHandler}
              page={currentPage}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default memo(WinnerTable);
