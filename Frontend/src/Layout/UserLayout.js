import React from "react";
import { Outlet } from "react-router-dom";
import Footer from "../Components/Footer";
import { Box } from "@mui/material";

const UserLayout = () => {
  return (
    <>
      <Box className="glass-container">
        <Outlet />
      </Box>
      <Footer />
    </>
  );
};

export default UserLayout;
