from flask import Flask, request, jsonify
from models import db, User, CouponUsage, Purchase
from referral_service import ReferralService

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///referral_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)


@app.before_first_request
def create_tables():
    db.create_all()


# ==================== User Registration ====================

@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user with optional referral code"""
    data = request.get_json()

    if not data or 'email' not in data or 'username' not in data:
        return jsonify({'error': 'Email and username are required'}), 400

    # Check if user already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already taken'}), 400

    # Validate referral code if provided
    referred_by_code = data.get('referred_by_code')
    if referred_by_code:
        referrer = User.query.filter_by(referral_code=referred_by_code).first()
        if not referrer:
            return jsonify({'error': 'Invalid referral code'}), 400

    try:
        user = User(
            email=data['email'],
            username=data['username'],
            referred_by_code=referred_by_code
        )
        db.session.add(user)
        db.session.commit()

        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


# ==================== Referral Code Operations ====================

@app.route('/api/referral/validate', methods=['POST'])
def validate_referral():
    """Validate if a referral code can be used by a user"""
    data = request.get_json()

    if not data or 'referral_code' not in data or 'user_id' not in data:
        return jsonify({'error': 'referral_code and user_id are required'}), 400

    is_valid, error_message, referrer = ReferralService.validate_referral_code(
        data['referral_code'],
        data['user_id']
    )

    if is_valid:
        return jsonify({
            'valid': True,
            'referrer': {
                'username': referrer.username,
                'referral_code': referrer.referral_code
            }
        }), 200
    else:
        return jsonify({
            'valid': False,
            'error': error_message
        }), 400


@app.route('/api/referral/stats/<int:user_id>', methods=['GET'])
def get_referral_stats(user_id):
    """Get referral statistics for a user"""
    stats = ReferralService.get_referral_stats(user_id)

    if stats is None:
        return jsonify({'error': 'User not found'}), 404

    return jsonify(stats), 200


# ==================== Purchase Operations ====================

@app.route('/api/purchase', methods=['POST'])
def create_purchase():
    """Create a purchase with optional referral code"""
    data = request.get_json()

    if not data or 'user_id' not in data or 'amount' not in data:
        return jsonify({'error': 'user_id and amount are required'}), 400

    try:
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({'error': 'Amount must be positive'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid amount'}), 400

    referral_code = data.get('referral_code')

    success, message, purchase_data = ReferralService.create_purchase(
        data['user_id'],
        amount,
        referral_code
    )

    if success:
        return jsonify({
            'message': message,
            'data': purchase_data
        }), 201
    else:
        return jsonify({'error': message}), 400


@app.route('/api/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get user details"""
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify(user.to_dict()), 200


@app.route('/api/user/<int:user_id>/purchases', methods=['GET'])
def get_user_purchases(user_id):
    """Get all purchases for a user"""
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    purchases = Purchase.query.filter_by(user_id=user_id).order_by(Purchase.created_at.desc()).all()

    return jsonify({
        'user_id': user_id,
        'total_purchases': len(purchases),
        'purchases': [p.to_dict() for p in purchases]
    }), 200


# ==================== Admin/Testing Endpoints ====================

@app.route('/api/users', methods=['GET'])
def get_all_users():
    """Get all users (for testing)"""
    users = User.query.all()
    return jsonify([user.to_dict() for user in users]), 200


@app.route('/api/coupon-usages', methods=['GET'])
def get_all_coupon_usages():
    """Get all coupon usages (for testing)"""
    usages = CouponUsage.query.all()
    return jsonify([usage.to_dict() for usage in usages]), 200


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)