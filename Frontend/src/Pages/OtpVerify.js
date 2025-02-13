import React, { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Box,
  TextField,
  Typography,
  Container,
  Paper,
  useMediaQuery,
} from "@mui/material";
import LoadingButton from "../Components/UI/LoadingButton";
import { useNavigate } from "react-router-dom";
import { blue, grey } from "@mui/material/colors";
import API from "../Api/ApiCall";
import { useDispatch, useSelector } from "react-redux";
import {
  registerUser,
  selectAuthRegistrationData,
  selectAuthForgotPhoneData,
  setForgotPhoneData,
} from "../Feature/Auth/authSlice";
import { toast } from "react-toastify";
import AuthLogo from "../Components/UI/AuthLogo";
import { useLocation } from "react-router-dom/dist/umd/react-router-dom.development";
import AuthTextField from "../Components/Auth/AuthTextField";
import AuthButton from "../Components/Auth/AuthButton";

export default function OtpVerify() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const { context } = location.state || {};
  const otpRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [resendButtonDisabled, setResendButtonDisabled] = useState(true);
  const [timer, setTimer] = useState(300);
  const registrationData = useSelector(selectAuthRegistrationData);
  const forgotPhoneNumber = useSelector(selectAuthForgotPhoneData);

  const startTimer = () => {
    setTimer(300); // Reset the timer to 120 seconds
    setResendButtonDisabled(true);
    const interval = setInterval(() => {
      setTimer((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(interval);
          setResendButtonDisabled(false);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  };

  useEffect(() => {
    const intervalId = startTimer(); // Initialize the timer on component mount
    return intervalId; // Cleanup function to clear the interval when the component unmounts
  }, []);

  const {
    control,
    watch,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm({
    defaultValues: {
      otp: ["", "", "", ""],
    },
    mode: "onChange",
  });
  const otpValues = watch("otp");
  const allOtpFilled = otpValues.every((val) => val.length === 1);

  const onSubmit = async (data) => {
    const otp = (data?.otp).map(String).join("");
    try {
      setLoading(true);
      let mobile_number =
        context === "forgot"
          ? forgotPhoneNumber.mobile_number
          : registrationData.mobileNumber;
      const combinedData = {
        mobile_number: mobile_number,
        otp: otp,
      };
      const { status } = await API.verifyOtpAPI(combinedData);
      if (status === 200 && context === "forgot") {
        dispatch(
          setForgotPhoneData({
            mobileNumber: forgotPhoneNumber.mobile_number,
            otpVerified: true,
          })
        );
        return navigate("/auth/reset-password");
      } else {
        const userData = {
          mobile_number: registrationData.mobileNumber,
          username: registrationData.name,
          password: registrationData.password,
        };
        if (registrationData.referCode) {
          userData.refer_code = registrationData.referCode;
        }
        dispatch(registerUser({ userData, navigate }));
      }
    } catch (error) {
      setLoading(false);
      return toast.error(
        error.response?.data?.detail || "No response received" || error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    const inputs = otpRef.current.querySelectorAll("input");
    const index = [...inputs].indexOf(e.target);
    if (e.target.value && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Backspace") {
      const inputs = otpRef.current.querySelectorAll("input");
      const index = [...inputs].indexOf(e.target);
      if (e.target.value === "" && index > 0) {
        inputs[index - 1].focus();
      }
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  const handleResendOtp = async () => {
    try {
      setResendButtonDisabled(true);
      let mobile_number =
        context === "forgot"
          ? forgotPhoneNumber.mobile_number
          : registrationData.mobileNumber;
      if (context === "forgot") {
        await API.sendOtpForgotAPI({ mobile_number });
      } else {
        await API.sendOtpAPI({ mobile_number });
      }
    } catch (error) {
      return toast.error(
        error.response?.data?.detail || "No response received" || error.message
      );
    } finally {
      startTimer();
    }
  };
  const isMobile = useMediaQuery("(max-width:600px)");

  return (
    <Box
      height="100vh"
      display="flex"
      justifyContent="center"
      alignItems="center"
      className="glass-container"
    >
      <Paper
        elevation={0}
        sx={{
          width: isMobile ? "90%" : "400px",
          padding: "40px",
          background: "rgba(255, 255, 255, 0.1)",
          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(16px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(16px) saturate(180%)",
          backgroundColor: "rgba(255, 255, 255, 0.5)",
          borderRadius: "12px",
          border: "1px solid rgba(209, 213, 219, 0.3)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="h6"
            align="center"
            gutterBottom
            color={grey[500]}
            sx={{
              fontFamily: "Ubuntu,sans-serif",
              fontWeight: 300,
            }}
          >
            OTP Verification
          </Typography>
          <Typography
            variant="h6"
            align="center"
            gutterBottom
            color={grey[500]}
            sx={{
              fontFamily: "Ubuntu,sans-serif",
              fontWeight: 300,
            }}
          >
            Enter OTP sent to +91
            {context === "forgot" ? (
              <span>{forgotPhoneNumber?.mobile_number}</span>
            ) : (
              <span>{registrationData?.mobileNumber}</span>
            )}
          </Typography>
          <Typography
            onClick={() => {
              context === "forgot"
                ? navigate("/auth/forgot-password")
                : navigate("/auth/register");
            }}
            variant="h6"
            align="center"
            gutterBottom
            color={grey[500]}
            sx={{
              fontFamily: "Ubuntu,sans-serif",
              fontWeight: 300,
            }}
          >
            Change Number
          </Typography>
          <Box display="flex" gap={2} my={6} ref={otpRef}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Controller
                name={`otp.${index}`}
                control={control}
                render={({ field }) => (
                  <AuthTextField
                    {...field}
                    type="tel"
                    sx={{ borderColor: grey[500] }}
                    inputProps={{
                      maxLength: 1,
                      style: { textAlign: "center" },
                      pattern: "[0-9]*",
                      inputMode: "numeric",
                    }}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                  />
                )}
                key={index}
              />
            ))}
          </Box>

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ mt: 1 }}
          >
            <AuthButton
              type="submit"
              fullWidth
              disabled={!allOtpFilled || !isValid || !isDirty}
              loading={loading}
              variant="contained"
            >
              Verify Otp
            </AuthButton>

            <Typography
              variant="h6"
              align="center"
              gutterBottom
              color={grey[500]}
              sx={{
                fontFamily: "Ubuntu,sans-serif",
                fontWeight: 300,
              }}
            >
              {formatTime(timer)}
            </Typography>

            <Typography
              variant="h6"
              align="center"
              gutterBottom
              color={grey[500]}
              sx={{
                fontFamily: "Ubuntu,sans-serif",
                fontWeight: 300,
              }}
            >
              Didn't receive the OTP?{" "}
              <Typography
                onClick={handleResendOtp}
                sx={{
                  cursor: resendButtonDisabled ? "default" : "pointer",
                  color: resendButtonDisabled ? grey[500] : blue[500],
                  fontFamily: "Ubuntu,sans-serif",
                  fontWeight: 300,
                }}
                component="span"
                variant="h6"
                align="center"
                gutterBottom
                color={grey[500]}
              >
                Resend
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
