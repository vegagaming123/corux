from fastapi import APIRouter, HTTPException, status, Depends,Query
from fastapi.responses import Response, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import desc,and_
from fastapi.responses import StreamingResponse
from io import BytesIO
import qrcode
from typing import Optional
from jwtAuth import authenticate_user
from utils.logger import setup_logger
from db_module.session import get_sql_db
from models.user import (
    Upi_Table,
    PaymentDepositTable,
    PaymentWithdrawTable,
    Bet_Color,
    Bet_Number,
    User,
)
from schema.user import amount_schema, utr_schema, withdraw_schema
from sqlalchemy import text, delete, func, select
import random
import base64
import uuid


router = APIRouter()
logger = setup_logger()


@router.post("/generate-qr/")
async def generate_qr(
    amount: amount_schema,
    credentials: HTTPAuthorizationCredentials = Depends(authenticate_user),
    db: Session = Depends(get_sql_db),
):
    try:
        user = db.query(User).filter(User.mobile_number == credentials.mobile_number).first()

        if not user:
            raise HTTPException(status_code=400,detail="User Not Found")
        
        if user.is_blocked:
            raise HTTPException(status_code=400,detail="User Blocked")
        if amount.amount < 100:
            raise HTTPException(status_code=400,detail="Enter Amount 100 or More")
        
        upi_query_list = db.query(Upi_Table).all()
        upi_list = [row.upi_id for row in upi_query_list]

        x = random.randint(0, len(upi_list) - 1)
        upi_link = f"upi://pay?pa={upi_list[x]}&pn=gourav&am={amount.amount}&cu=INR"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(upi_link)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img_byte_arr = BytesIO()
        img.save(img_byte_arr, format="PNG")
        img_byte_arr.seek(0)

        transaction_id = uuid.uuid4()
        new_transaction_entry = PaymentDepositTable(
            MOBILE_NUMBER=credentials.mobile_number,
            ADMIN_UPI_ID=upi_list[x],
            AMOUNT=amount.amount,
            TRANSACTION_ID=transaction_id,
        )

        db.add(new_transaction_entry)
        db.commit()
        img_base64 = base64.b64encode(img_byte_arr.getvalue()).decode("utf-8")

        response_data = {
            "qr_code": img_base64,
            "transaction_id": str(transaction_id),
        }

        return JSONResponse(content=response_data)
    except HTTPException as e:
        logger.error(str(e))
        raise HTTPException(status_code=e.status_code,detail=e.detail)
    except Exception as e:
        logger.error(f"Failed to generate QR code: {str(e)}")
        raise e


# Patch Request to update UTR number.
@router.patch("/save-utr/")
async def save_utr(
    utr: utr_schema,
    credentials: HTTPAuthorizationCredentials = Depends(authenticate_user),
    db: Session = Depends(get_sql_db),
):
    try:
        user = db.query(User).filter(User.mobile_number == credentials.mobile_number).first()

        if not user:
            raise HTTPException(status_code=400,detail="User Not Found")
        
        if user.is_blocked:
            raise HTTPException(status_code=400,detail="User Blocked")
        transaction = (
            db.query(PaymentDepositTable)
            .filter(
                and_(PaymentDepositTable.TRANSACTION_ID == uuid.UUID(utr.transaction_id),PaymentDepositTable.MOBILE_NUMBER == credentials.mobile_number)
            )
            .first()
        )
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction Not Found")

        transaction.UTR = utr.utr
        db.commit()
        return {"status_code": 200, "message": "Successfully Updated UTR"}
    except HTTPException as e:
        logger.error(str(e))
        raise HTTPException(status_code=e.status_code,detail=e.detail)
    except Exception as e:
        logger.error(f"Failed to generate QR code: {str(e)}")
        raise e


@router.post("/withdraw/")
async def winthdraw(
    withdraw_schema: withdraw_schema,
    credentials: HTTPAuthorizationCredentials = Depends(authenticate_user),
    db: Session = Depends(get_sql_db),
):
    try:
        user = db.query(User).filter(User.mobile_number == credentials.mobile_number).first()

        if not user:
            raise HTTPException(status_code=400,detail="User Not Found")
        
        if user.is_blocked:
            raise HTTPException(status_code=400,detail="User Blocked")
        if withdraw_schema.amount < 100:
            raise HTTPException(status_code=400, detail="Enter Amount 100 or More")

        user = (
            db.query(User)
            .filter(User.mobile_number == credentials.mobile_number)
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=400, detail="Cannot Found User!!Login Again"
            )

        if user.balance < withdraw_schema.amount:
            raise HTTPException(status_code=400, detail="Insufficient Balance")

        lastest_deposit = (
            db.query(PaymentDepositTable)
            .filter(PaymentDepositTable.MOBILE_NUMBER == credentials.mobile_number)
            .order_by(desc(PaymentDepositTable.CREATE_DATE))
            .first()
        )
        # logger.info([row._asdict() for row in lastest_deposit])
        if lastest_deposit:
            latest_bet_color = (
                db.query(Bet_Color)
                .filter(
                    and_(Bet_Color.mobile_number == credentials.mobile_number,Bet_Color.CREATE_DATE >= lastest_deposit.CREATE_DATE)
                )
                .first()
                or None
            )
            # logger.info([row._asdict() for row in lastest_deposit])
            if not latest_bet_color:
                latest_bet_number = (
                    db.query(Bet_Number)
                    .filter(
                        and_(Bet_Number.mobile_number == credentials.mobile_number,Bet_Number.CREATE_DATE > lastest_deposit.CREATE_DATE)
                    )
                    .first()
                    or None
                )
                if not latest_bet_number:
                    raise HTTPException(
                        status_code=400,
                        detail="Please play a game before using your latest deposit.",
                    )
        user.balance = user.balance - withdraw_schema.amount
        new_withdraw_request = PaymentWithdrawTable(
            MOBILE_NUMBER=credentials.mobile_number,
            USER_UPI_ID=withdraw_schema.user_upi,
            AMOUNT=withdraw_schema.amount,
        )

        db.add(new_withdraw_request)
        db.commit()

        return {"status_code": 200, "detail": "Successfully Placed Withdrawl request"}
    except HTTPException as e:
        logger.error(str(e))
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(str(e))
        raise e

@router.get("/recharge-transaction/")
async def recharge_transaction(
    limit: int = Query(10, gt=0), 
    offset: int = Query(0, ge=0),
    credentials: HTTPAuthorizationCredentials = Depends(authenticate_user),
    db: Session = Depends(get_sql_db)
):
    try:
        recharge_trans = db.query(PaymentDepositTable).filter(PaymentDepositTable.MOBILE_NUMBER ==  credentials.mobile_number).order_by(desc(PaymentDepositTable.CREATE_DATE)).offset(offset).limit(limit)

        if not recharge_trans:
            return []
        
        return [{"date":row.CREATE_DATE,"amount":row.AMOUNT,"approved":row.APPROVE_DEPOSIT,"denied":row.DENY_DEPOSIT} for row in recharge_trans]
    except HTTPException as e:
        logger.error(str(e))
        raise HTTPException(status_code=e.status_code,detail=e.detail)
    except Exception as e:
        logger.error(str(e))
        raise e
    
@router.get("/withdraw-transaction/")
async def withdraw_transaction(
    limit: int = Query(10, gt=0), 
    offset: int = Query(0, ge=0),
    credentials: HTTPAuthorizationCredentials = Depends(authenticate_user),
    db: Session = Depends(get_sql_db)
):
    try:
        withdraw_trans = db.query(PaymentWithdrawTable).filter(PaymentWithdrawTable.MOBILE_NUMBER ==  credentials.mobile_number).order_by(desc(PaymentWithdrawTable.CREATE_DATE)).offset(offset).limit(limit)

        if not withdraw_trans:
            return []
        
        return [{"date":row.CREATE_DATE,"amount":row.AMOUNT,"approved":row.APPROVE_WITHDRAW,"upi":row.USER_UPI_ID} for row in withdraw_trans]
    except HTTPException as e:
        logger.error(str(e))
        raise HTTPException(status_code=e.status_code,detail=e.detail)
    except Exception as e:
        logger.error(str(e))
        raise e

